import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import { sql } from '../db/connection-postgres.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const router = Router();

// Create new enquiry
router.post('/', async (req: Request, res: Response) => {
  try {

    const {
      venue_id,
      venue_name,
      user_id,
      name,
      email,
      phone,
      event_date,
      guest_count,
      event_type,
      requirements,
      status = 'pending'
    } = req.body;

    // Validation
    if (!venue_id || !venue_name || !name || !email || !event_date || !guest_count || !event_type || !requirements) {
      return res.status(400).json({
        error: 'Missing required fields: venue_id, venue_name, name, email, event_date, guest_count, event_type, requirements'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Date validation
    const eventDateObj = new Date(event_date);
    if (eventDateObj <= new Date()) {
      return res.status(400).json({ error: 'Event date must be in the future' });
    }

    // Numeric validation
    if (guest_count <= 0) {
      return res.status(400).json({ error: 'Guest count must be a positive number' });
    }

    // Create enquiry in database
    const enquiryId = uuidv4();
    const result = await sql`
      INSERT INTO inquiries (
        id, name, email, phone, venue_name, event_date, event_type,
        guest_count, requirements, status, negotiation_history
      ) VALUES (
        ${enquiryId}, ${name}, ${email}, ${phone || ''}, ${venue_name},
        ${event_date}, ${event_type}, ${Number(guest_count)}, ${requirements}, ${status},
        ${JSON.stringify([])}
      )
      RETURNING *
    `;

    const enquiry = result[0];

    // Process the enquiry with SmythOS agent in the background
    // Pass venue_id directly since it's not stored in database
    processEnquiryWithAgent({...enquiry, venue_id});

    res.status(201).json({
      success: true,
      message: 'Enquiry submitted successfully',
      enquiry: {
        id: enquiry.id,
        status: enquiry.status,
        createdAt: enquiry.createdAt,
        venue_name: enquiry.venue_name
      }
    });
  } catch (error) {
    console.error('Error creating enquiry:', error);
    res.status(500).json({ error: 'Failed to submit enquiry' });
  }
});

// Get enquiries for a user (by email if not authenticated, by user_id if authenticated)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, email } = req.query;

    if (!user_id && !email) {
      return res.status(400).json({ error: 'user_id or email is required' });
    }

    let userEnquiries: any[] = [];

    if (user_id) {
      userEnquiries = await sql`
        SELECT * FROM inquiries WHERE user_id = ${user_id?.toString()} ORDER BY created_at DESC
      `;
    } else if (email) {
      userEnquiries = await sql`
        SELECT * FROM inquiries WHERE email = ${email?.toString()} ORDER BY created_at DESC
      `;
    }

    res.json({
      success: true,
      enquiries: userEnquiries
    });
  } catch (error) {
    console.error('Error fetching enquiries:', error);
    res.status(500).json({ error: 'Failed to fetch enquiries' });
  }
});

// Get specific enquiry by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const results = await sql`SELECT * FROM inquiries WHERE id = ${id}`;
    const enquiry = results[0];

    if (!enquiry) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }

    res.json({
      success: true,
      enquiry
    });
  } catch (error) {
    console.error('Error fetching enquiry:', error);
    res.status(500).json({ error: 'Failed to fetch enquiry' });
  }
});

// Update enquiry status (for venue owners or admins)
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, venue_owner_response, agent_response } = req.body;

    // Check if enquiry exists
    const existingResult = await sql`SELECT * FROM inquiries WHERE id = ${id}`;
    if (existingResult.length === 0) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }

    const enquiry = existingResult[0];

    // Prepare update values
    const updateFields = [];
    const updateValues = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      updateFields.push(`status = $${paramCount}`);
      updateValues.push(status);
    }

    if (venue_owner_response) {
      paramCount++;
      updateFields.push(`venue_response = $${paramCount}`);
      updateValues.push(venue_owner_response);
    }

    if (agent_response) {
      paramCount++;
      updateFields.push(`agent_response = $${paramCount}`);
      updateValues.push(agent_response);
    }

    // Add to negotiation history
    let updatedHistory = enquiry.negotiation_history || [];
    if (venue_owner_response || agent_response) {
      updatedHistory.push({
        timestamp: new Date().toISOString(),
        type: venue_owner_response ? 'venue_owner' : 'agent',
        message: venue_owner_response || agent_response
      });
    }

    paramCount++;
    updateFields.push(`negotiation_history = $${paramCount}`);
    updateValues.push(JSON.stringify(updatedHistory));

    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    updateValues.push(new Date());

    // Update in database
    updateValues.push(id);
    const updateQuery = `UPDATE inquiries SET ${updateFields.join(', ')} WHERE id = $${paramCount + 1} RETURNING *`;
    const result = await sql.unsafe(updateQuery, updateValues);
    const updatedEnquiry = result[0];

    res.json({
      success: true,
      message: 'Enquiry updated successfully',
      enquiry: updatedEnquiry
    });
  } catch (error) {
    console.error('Error updating enquiry:', error);
    res.status(500).json({ error: 'Failed to update enquiry' });
  }
});

// API endpoint for SmythOS agent to store/update enquiry responses
router.post('/agent-response', async (req: Request, res: Response) => {
  try {
    const {
      enquiry_id,
      agent_response,
      venue_owner_response,
      status,
      negotiation_data,
      recommendations
    } = req.body;

    // Validation
    if (!enquiry_id) {
      return res.status(400).json({ error: 'enquiry_id is required' });
    }

    // Check if enquiry exists
    const existingResult = await sql`SELECT * FROM inquiries WHERE id = ${enquiry_id}`;
    if (existingResult.length === 0) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }

    const enquiry = existingResult[0];

    // Prepare update query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 0;

    // Handle negotiation history
    let updatedHistory = enquiry.negotiation_history || [];

    if (agent_response) {
      paramCount++;
      updateFields.push(`agent_response = $${paramCount}`);
      updateValues.push(agent_response);

      updatedHistory.push({
        timestamp: new Date().toISOString(),
        type: 'agent',
        message: agent_response
      });
    }

    if (venue_owner_response) {
      paramCount++;
      updateFields.push(`venue_response = $${paramCount}`);
      updateValues.push(venue_owner_response);

      updatedHistory.push({
        timestamp: new Date().toISOString(),
        type: 'venue_owner',
        message: venue_owner_response
      });
    }

    if (status) {
      paramCount++;
      updateFields.push(`status = $${paramCount}`);
      updateValues.push(status);
    }

    // Update negotiation history
    paramCount++;
    updateFields.push(`negotiation_history = $${paramCount}`);
    updateValues.push(JSON.stringify(updatedHistory));

    // Always update timestamp
    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    updateValues.push(new Date());

    // Update in database
    updateValues.push(enquiry_id);
    const updateQuery = `UPDATE inquiries SET ${updateFields.join(', ')} WHERE id = $${paramCount + 1} RETURNING *`;
    const result = await sql.unsafe(updateQuery, updateValues);
    const updatedEnquiry = result[0];

    res.json({
      success: true,
      message: 'Enquiry updated successfully',
      enquiry: {
        id: updatedEnquiry.id,
        status: updatedEnquiry.status,
        updated_at: updatedEnquiry.updated_at
      }
    });

    console.log(`Enquiry ${enquiry_id} updated by SmythOS agent`);

  } catch (error) {
    console.error('Error updating enquiry via agent:', error);
    res.status(500).json({ error: 'Failed to update enquiry' });
  }
});

// API endpoint to get enquiry details for SmythOS agent
router.get('/agent-data/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await sql`SELECT * FROM inquiries WHERE id = ${id}`;
    const enquiry = result[0];

    if (!enquiry) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }

    // Get venue contact information
    let venueContactDetails: any = {
      email: 'contact@venue.com',
      phone: '+1-555-VENUE-000',
      manager_name: 'Venue Manager'
    };

    try {
      const venuesData = JSON.parse(
        require('fs').readFileSync(require('path').join(__dirname, '../../data/venues.json'), 'utf-8')
      );
      const venue = venuesData.find((v: any) => v.venue_id === enquiry.venue_id);

      if (venue) {
        venueContactDetails = {
          email: venue.contact_email || venue.email || 'contact@' + venue.name.toLowerCase().replace(/\s+/g, '') + '.com',
          phone: venue.contact_phone || venue.phone || '+1-555-VENUE-' + Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
          manager_name: venue.manager_name || 'Venue Manager',
          address: venue.address || `${venue.city}, ${venue.state}`,
          website: venue.website || `https://${venue.name.toLowerCase().replace(/\s+/g, '')}.com`
        };
      }
    } catch (error) {
      console.warn('Could not load venue contact info for agent data:', (error as Error).message);
    }

    // Return enquiry data formatted for agent processing
    const agentData = {
      enquiry_id: enquiry.id,
      venue_id: enquiry.venue_id,
      venue_name: enquiry.venue_name,
      venue_contact: venueContactDetails,
      customer_details: {
        name: enquiry.name,
        email: enquiry.email,
        phone: enquiry.phone
      },
      event_details: {
        date: enquiry.event_date,
        type: enquiry.event_type,
        guest_count: enquiry.guest_count,
        requirements: enquiry.requirements
      },
      status: enquiry.status,
      created_at: enquiry.createdAt,
      negotiation_history: enquiry.negotiation_history
    };

    res.json({
      success: true,
      enquiry: agentData
    });

  } catch (error) {
    console.error('Error fetching enquiry for agent:', error);
    res.status(500).json({ error: 'Failed to fetch enquiry data' });
  }
});

// Process enquiry with SmythOS agent
async function processEnquiryWithAgent(enquiry: any) {
  try {
    const cacheKey = `agent-enquiry-${enquiry.id}`;

    // Get venue details to include contact information
    let venueContactInfo = '';
    try {
      // Load venue data to get contact information
      // Get correct directory path for ES modules
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const venuePath = join(__dirname, '../../data/venues.json');

      console.log('Attempting to load venues from path:', venuePath);
      console.log('__dirname is:', __dirname);

      const venuesData = JSON.parse(readFileSync(venuePath, 'utf-8'));
      console.log('Venues data loaded, total venues:', venuesData.length);

      const venue = venuesData.find((v: any) => v.venue_id === enquiry.venue_id);
      console.log("VENUE DETAILS for venue_id", enquiry.venue_id, ":", venue)

      if (venue) {
        venueContactInfo = `
Venue Contact Information:
- Email: ${venue.contact_email || venue.email || 'contact@' + venue.name.toLowerCase().replace(/\s+/g, '') + '.com'}
- Phone: ${venue.contact_phone || venue.phone || '+1-555-VENUE-' + Math.floor(Math.random() * 1000).toString().padStart(3, '0')}
- Manager: ${venue.manager_name || 'Venue Manager'}
        `;
      }
    } catch (error) {
      console.error('Could not load venue contact info. Error:', (error as Error).message);
      console.error('Error stack:', (error as Error).stack);
    }

    // Prepare the enquiry data as JSON for the agent
    const enquiryData = {
      enquiry_id: enquiry.id,
      customer: {
        name: enquiry.name,
        email: enquiry.email,
        phone: enquiry.phone
      },
      event: {
        date: enquiry.event_date,
        type: enquiry.event_type,
        guest_count: enquiry.guest_count
      },
      requirements: enquiry.requirements,
      venue: {
        name: enquiry.venue_name,
        contact_email: venueContactInfo.includes('- Email:') ?
          venueContactInfo.split('- Email:')[1]?.split('\n')[0]?.trim() || 'Not available' : 'Not available',
        contact_phone: venueContactInfo.includes('- Phone:') ?
          venueContactInfo.split('- Phone:')[1]?.split('\n')[0]?.trim() || 'Not available' : 'Not available',
        manager_name: venueContactInfo.includes('- Manager:') ?
          venueContactInfo.split('- Manager:')[1]?.split('\n')[0]?.trim() || 'Not available' : 'Not available'
      }
    };

    console.log('Processing enquiry with SmythOS agent:', enquiry.id, enquiryData);

    // Call SmythOS Reply_Agent API
    const response = await fetch('https://cmfvy00gpxdpqo3wtm3zjmdtq.agent.pa.smyth.ai/api/Reply_Agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(enquiryData)
    });

    if (response.ok) {
      // SmythOS Reply_Agent returns text/plain response
      const agentResponse = await response.text();
      console.log('Received agent response for enquiry:', enquiry.id);

      // Get current negotiation history
      const enquiryResult = await sql`SELECT negotiation_history FROM inquiries WHERE id = ${enquiry.id}`;
      const currentHistory = enquiryResult[0]?.negotiation_history || [];

      // Add new agent response to history
      currentHistory.push({
        timestamp: new Date().toISOString(),
        type: 'agent',
        message: agentResponse
      });

      // Update enquiry in database
      await sql`
        UPDATE inquiries SET agent_response = ${agentResponse}, negotiation_history = ${JSON.stringify(currentHistory)}, updated_at = ${new Date()} WHERE id = ${enquiry.id}
      `;
    } else {
      console.warn('SmythOS agent not available for enquiry:', enquiry.id);

      // Add fallback response
      await sql`
        UPDATE inquiries SET agent_response = ${'Enquiry received and is being processed. We will get back to you within 24 hours.'}, updated_at = ${new Date()} WHERE id = ${enquiry.id}
      `;
    }
  } catch (error) {
    console.error('Error processing enquiry with agent:', error);

    // Add error response
    await sql`
      UPDATE inquiries SET agent_response = ${'Enquiry received. Our team will review it manually and respond within 24 hours.'}, updated_at = ${new Date()} WHERE id = ${enquiry.id}
    `;
  }
}

// Endpoint to receive venue responses from Smyth agent
router.post('/enquiry-responses', async (req: Request, res: Response) => {
  try {
    const { enquiry_id, venue_response, status } = req.body;

    // Validate request body
    if (!enquiry_id || !venue_response) {
      return res.status(400).json({
        error: 'enquiry_id and venue_response are required'
      });
    }

    console.log('Received venue response for enquiry:', enquiry_id);

    // Find and update the enquiry with venue response
    const existingResult = await sql`SELECT * FROM inquiries WHERE id = ${enquiry_id}`;

    if (existingResult.length === 0) {
      return res.status(404).json({
        error: 'Enquiry not found'
      });
    }

    const enquiry = existingResult[0];

    // Update negotiation history
    const currentHistory = enquiry.negotiation_history || [];
    currentHistory.push({
      timestamp: new Date().toISOString(),
      type: 'venue_manager',
      message: venue_response,
      status: status
    });

    // Update the enquiry with venue manager's response
    await sql`
      UPDATE inquiries SET venue_response = ${venue_response}, status = ${status || 'pending'}, negotiation_history = ${JSON.stringify(currentHistory)}, updated_at = ${new Date()} WHERE id = ${enquiry_id}
    `;

    console.log('Updated enquiry with venue response:', enquiry_id);

    res.json({
      success: true,
      message: 'Venue response received and stored',
      enquiry_id: enquiry_id
    });

  } catch (error) {
    console.error('Error processing venue response:', error);
    res.status(500).json({
      error: 'Failed to process venue response',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;