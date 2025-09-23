import { Router } from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

// Load venues from JSON file
const getVenuesFromJson = () => {
  try {
    const venuesFilePath = join(__dirname, '../../data/venues.json');
    const venuesData = readFileSync(venuesFilePath, 'utf-8');
    return JSON.parse(venuesData);
  } catch (error) {
    console.error('Error loading venues from JSON:', error);
    return [];
  }
};

// Simple filtering helpers
const toStr = (v: any) => (typeof v === 'string' ? v : (v ?? '') + '');
const ciEq = (a: any, b: any) => toStr(a).trim().toLowerCase() === toStr(b).trim().toLowerCase();
const ciIncludes = (hay: any, needle: any) => toStr(hay).toLowerCase().includes(toStr(needle).toLowerCase());
const asArray = (v: any) => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return toStr(v).split(',').map(x => x.trim()).filter(Boolean);
};

router.get('/', async (req, res) => {
  try {
    const { query, city, minCapacity, maxPricePerHour, amenities } = req.query;
    const venues = getVenuesFromJson();
    let filteredVenues = [...venues];

    // Apply filters
    if (query) {
      const searchTerm = query.toString().toLowerCase();
      filteredVenues = filteredVenues.filter(venue =>
        ciIncludes(venue.name, searchTerm) ||
        ciIncludes(venue.city, searchTerm) ||
        (venue.amenities && asArray(venue.amenities).some((amenity: string) => ciIncludes(amenity, searchTerm)))
      );
    }

    if (city) {
      filteredVenues = filteredVenues.filter(venue => ciEq(venue.city, city));
    }

    if (minCapacity) {
      const minCap = parseInt(minCapacity.toString());
      filteredVenues = filteredVenues.filter(venue => (venue.capacity || 0) >= minCap);
    }

    if (maxPricePerHour) {
      const maxPrice = parseInt(maxPricePerHour.toString());
      filteredVenues = filteredVenues.filter(venue =>
        (venue.price_per_hour || venue.hourly_rate || 0) <= maxPrice
      );
    }

    if (amenities) {
      const requiredAmenities = asArray(amenities);
      filteredVenues = filteredVenues.filter(venue => {
        const venueAmenities = asArray(venue.amenities);
        return requiredAmenities.every(reqAmenity =>
          venueAmenities.some(venueAmenity => ciIncludes(venueAmenity, reqAmenity))
        );
      });
    }

    // Sort by capacity (descending) and limit to 5
    filteredVenues.sort((a, b) => (b.capacity || 0) - (a.capacity || 0));
    filteredVenues = filteredVenues.slice(0, 5);

    // Add venue_id field and map API fields to frontend expectations
    const venuesWithVenueId = filteredVenues.map(venue => ({
      ...venue,
      venue_id: venue.venue_id || venue.id,
      // Map price fields for frontend compatibility
      pricePerHour: venue.price_per_hour || venue.hourly_rate || Math.round((venue.price_per_day || 0) / 8), // Convert daily to hourly estimate
      // Ensure amenities is an array
      amenities: venue.amenities || ''
    }));

    const responseData = {
      venues: venuesWithVenueId,
      total: venuesWithVenueId.length,
      displayed: venuesWithVenueId.length
    };

    res.json(responseData);
  } catch (error) {
    console.error('Error fetching venues:', error);
    res.status(500).json({ error: 'Failed to fetch venues' });
  }
});

// Advanced venue search endpoint
router.post('/search', async (req, res) => {
  try {
    const {
      city, state, country, metro_area,
      capacity_min, capacity_max, type,
      amenities, tags,
      diamond_level, preferred_rating,
      lat, lon, radius_mi, airport_distance_max_mi,
      meeting_rooms_total, total_meeting_area_sqft, largest_space_sqft,
      price_per_hour_min, price_per_hour_max,
      limit = 10, offset = 0, fallback = false
    } = req.body || {};

    const venues = getVenuesFromJson();
    let filteredVenues = [...venues];

    // Apply filters
    if (city) {
      filteredVenues = filteredVenues.filter(v => {
        const venueCityNormalized = toStr(v.city).replace(/\s+/g, '').toLowerCase();
        const searchCityNormalized = toStr(city).replace(/\s+/g, '').toLowerCase();
        return ciEq(v.city, city) || venueCityNormalized === searchCityNormalized;
      });
    }

    if (state) {
      filteredVenues = filteredVenues.filter(v => ciEq(v.state, state));
    }

    if (country) {
      filteredVenues = filteredVenues.filter(v => ciEq(v.country, country));
    }

    if (metro_area) {
      filteredVenues = filteredVenues.filter(v => ciIncludes(v.metro_area, metro_area));
    }

    if (typeof capacity_min === 'number') {
      filteredVenues = filteredVenues.filter(v => (Number(v.capacity) || 0) >= capacity_min);
    }

    if (typeof capacity_max === 'number') {
      filteredVenues = filteredVenues.filter(v => {
        const cap = Number(v.capacity) || 0;
        return cap > 0 ? cap <= capacity_max : true;
      });
    }

    if (type) {
      filteredVenues = filteredVenues.filter(v => ciEq(v.type, type));
    }

    if (amenities && Array.isArray(amenities) && amenities.length > 0) {
      filteredVenues = filteredVenues.filter(v => {
        const venueAmenities = asArray(v.amenities);
        return amenities.every(reqAmenity =>
          venueAmenities.some(va => {
            const reqNormalized = reqAmenity.replace(/[_\s-]/g, ' ').toLowerCase();
            const vaNormalized = va.replace(/[_\s-]/g, ' ').toLowerCase();
            return vaNormalized.includes(reqNormalized) || reqNormalized.includes(vaNormalized);
          })
        );
      });
    }

    if (tags && Array.isArray(tags) && tags.length > 0) {
      filteredVenues = filteredVenues.filter(v => {
        const venueTags = asArray(v.tags);
        return tags.every(reqTag => venueTags.some(t => ciIncludes(t, reqTag)));
      });
    }

    if (diamond_level) {
      filteredVenues = filteredVenues.filter(v => ciEq(v.diamond_level, diamond_level));
    }

    if (preferred_rating) {
      filteredVenues = filteredVenues.filter(v => ciEq(v.preferred_rating, preferred_rating));
    }

    if (typeof meeting_rooms_total === 'number') {
      filteredVenues = filteredVenues.filter(v => (Number(v.meeting_rooms_total) || 0) >= meeting_rooms_total);
    }

    if (typeof total_meeting_area_sqft === 'number') {
      filteredVenues = filteredVenues.filter(v => (Number(v.total_meeting_area_sqft) || 0) >= total_meeting_area_sqft);
    }

    if (typeof largest_space_sqft === 'number') {
      filteredVenues = filteredVenues.filter(v => (Number(v.largest_space_sqft) || 0) >= largest_space_sqft);
    }

    if (typeof airport_distance_max_mi === 'number') {
      filteredVenues = filteredVenues.filter(v => (Number(v.airport_distance_mi) || Infinity) <= airport_distance_max_mi);
    }

    if (lat != null && lon != null && typeof radius_mi === 'number' && radius_mi > 0) {
      filteredVenues = filteredVenues.filter(v => {
        if (v.lat == null || v.lon == null) return false;
        const distance = haversineMi(Number(lat), Number(lon), Number(v.lat), Number(v.lon));
        return distance <= radius_mi;
      });
    }

    if (typeof price_per_hour_min === 'number' || typeof price_per_hour_max === 'number') {
      filteredVenues = filteredVenues.filter(v => {
        const price = Number(v.price_per_hour || v.hourly_rate || NaN);
        if (Number.isNaN(price)) return false;
        if (typeof price_per_hour_min === 'number' && price < price_per_hour_min) return false;
        if (typeof price_per_hour_max === 'number' && price > price_per_hour_max) return false;
        return true;
      });
    }

    // Fallback logic
    if (filteredVenues.length === 0 && fallback) {
      filteredVenues = getVenuesFromJson();

      if (state) {
        filteredVenues = filteredVenues.filter(v => ciEq(v.state, state));
      } else if (country) {
        filteredVenues = filteredVenues.filter(v => ciEq(v.country, country));
      }

      if (typeof capacity_min === 'number') {
        const fbCap = Math.floor(capacity_min * 0.8);
        filteredVenues = filteredVenues.filter(v => (Number(v.capacity) || 0) >= fbCap);
      }
    }

    // Sort by capacity (descending)
    filteredVenues.sort((a, b) => (Number(b.capacity) || 0) - (Number(a.capacity) || 0));

    // Deduplication
    const seenIds = new Set();
    const uniqueVenues = filteredVenues.filter(venue => {
      const id = venue.venue_id || venue.id;
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    // Pagination
    const total = uniqueVenues.length;
    const start = Math.max(0, Number(offset) || 0);
    const end = start + (Number(limit) || 10);
    const paginatedVenues = uniqueVenues.slice(start, end);

    const result = {
      venues: paginatedVenues,
      total,
      displayed: paginatedVenues.length,
      limit: Number(limit) || 10,
      offset: start,
      has_more: end < total
    };

    res.json(result);
  } catch (error) {
    console.error('Error searching venues:', error);
    res.status(500).json({ error: 'Failed to search venues' });
  }
});

// Distance calculation helper
const haversineMi = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 3958.8; // miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Get search context and results summary
router.get('/search-context', (req, res) => {
  try {
    const { query, total_results, displayed_results } = req.query;

    let contextText = '';
    let searchInsights: string[] = [];

    if (!query || !total_results) {
      return res.json({
        context_text: 'Browse all venues',
        search_insights: [],
        suggestions: ['Try searching for "venues for 100 people"', 'Search by city like "Seattle venues"', 'Look for specific amenities like "venues with catering"']
      });
    }

    const searchQuery = query.toString().toLowerCase();
    const totalCount = parseInt(total_results.toString()) || 0;
    const displayedCount = parseInt(displayed_results?.toString() || '0') || 0;

    // Generate contextual text based on search content
    if (searchQuery.includes('people') || searchQuery.includes('guests') || searchQuery.includes('capacity')) {
      const capacityMatch = searchQuery.match(/(\d+)\s*(people|guests)/);
      if (capacityMatch) {
        const capacity = capacityMatch[1];
        contextText = `Found ${totalCount} venues that can accommodate ${capacity} ${capacityMatch[2]}`;
        searchInsights.push(`Capacity: ${capacity} ${capacityMatch[2]}`);
      }
    }

    if (searchQuery.includes('seattle') || searchQuery.includes('portland') || searchQuery.includes('san francisco')) {
      const cityMatch = searchQuery.match(/(seattle|portland|san francisco|los angeles|new york)/i);
      if (cityMatch) {
        const city = cityMatch[1];
        contextText = contextText ? `${contextText} in ${city}` : `Found ${totalCount} venues in ${city}`;
        searchInsights.push(`Location: ${city}`);
      }
    }

    if (searchQuery.includes('catering') || searchQuery.includes('food') || searchQuery.includes('dining')) {
      searchInsights.push('🍽️ Catering available');
    }
    if (searchQuery.includes('parking')) searchInsights.push('🅿️ Parking included');
    if (searchQuery.includes('wifi') || searchQuery.includes('internet')) searchInsights.push('📶 WiFi available');
    if (searchQuery.includes('wheelchair') || searchQuery.includes('accessible')) searchInsights.push('♿ Wheelchair accessible');
    if (searchQuery.includes('av equipment') || searchQuery.includes('audio visual')) searchInsights.push('🎥 AV equipment available');
    if (searchQuery.includes('wedding') || searchQuery.includes('reception')) searchInsights.push('💒 Wedding venues');
    if (searchQuery.includes('corporate') || searchQuery.includes('business') || searchQuery.includes('conference')) searchInsights.push('💼 Corporate events');
    if (searchQuery.includes('luxury') || searchQuery.includes('upscale') || searchQuery.includes('premium')) searchInsights.push('⭐ Luxury venues');
    if (searchQuery.includes('outdoor') || searchQuery.includes('garden') || searchQuery.includes('patio')) searchInsights.push('🌿 Outdoor spaces');
    if (searchQuery.includes('downtown') || searchQuery.includes('city center')) searchInsights.push('🏙️ Downtown location');

    // Default context if no specific patterns found
    if (!contextText) {
      contextText = `Found ${totalCount} venues matching your search`;
    }

    // Add showing count if different from total
    if (displayedCount < totalCount) {
      contextText += ` (showing ${displayedCount})`;
    }

    // Generate suggestions based on search context
    let suggestions: string[] = [];
    if (totalCount === 0) {
      suggestions = [
        'Try broadening your search criteria',
        'Search in nearby cities',
        'Consider alternative venue types',
        'Check different capacity ranges'
      ];
    } else if (totalCount < 5) {
      suggestions = [
        'Try searching in nearby areas for more options',
        'Consider adjusting your capacity requirements',
        'Explore different venue types'
      ];
    } else if (totalCount > 20) {
      suggestions = [
        'Add more specific requirements to narrow results',
        'Specify preferred amenities',
        'Filter by location or capacity'
      ];
    }

    const searchQuality = {
      specificity: searchInsights.length > 2 ? 'high' : searchInsights.length > 0 ? 'medium' : 'low',
      result_count_status: totalCount === 0 ? 'no_results' : totalCount < 5 ? 'few_results' : totalCount > 20 ? 'many_results' : 'good_results'
    };

    res.json({
      context_text: contextText,
      search_insights: searchInsights,
      suggestions: suggestions,
      search_quality: searchQuality,
      total_venues: totalCount,
      displayed_venues: displayedCount
    });

  } catch (error) {
    console.error('Error generating search context:', error);
    res.status(500).json({
      error: 'Failed to generate search context',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get venue by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const venues = getVenuesFromJson();
    const venue = venues.find((v: any) => v.venue_id === id || v.id === id);

    if (!venue) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    // Add venue_id field and map API fields to frontend expectations
    const venueWithVenueId = {
      ...venue,
      venue_id: venue.venue_id || venue.id,
      // Map price fields for frontend compatibility
      pricePerHour: venue.price_per_hour || venue.hourly_rate || Math.round((venue.price_per_day || 0) / 8), // Convert daily to hourly estimate
      // Ensure amenities is an array
      amenities: venue.amenities || ''
    };

    res.json(venueWithVenueId);
  } catch (error) {
    console.error('Error fetching venue:', error);
    res.status(500).json({ error: 'Failed to fetch venue' });
  }
});

// Endpoint to append new venue data to venues.json
router.post('/append', (req, res) => {
  try {
    const { venues: newVenues } = req.body;

    if (!newVenues || !Array.isArray(newVenues)) {
      return res.status(400).json({ error: 'Request body must contain a "venues" array' });
    }

    if (newVenues.length === 0) {
      return res.status(400).json({ error: 'Venues array cannot be empty' });
    }

    const requiredFields = ['name', 'city', 'state'];
    const validatedVenues = [];

    for (let i = 0; i < newVenues.length; i++) {
      const venue = newVenues[i];

      for (const field of requiredFields) {
        if (!venue[field]) {
          return res.status(400).json({
            error: `Missing required field "${field}" in venue at index ${i}`
          });
        }
      }

      if (!venue.venue_id) {
        venue.venue_id = uuidv4();
      }

      const defaultVenue = {
        venue_id: venue.venue_id,
        name: venue.name,
        brand: venue.brand || '',
        chain: venue.chain || '',
        type: venue.type || 'VENUE',
        city: venue.city,
        state: venue.state,
        country: venue.country || 'US',
        metro_area: venue.metro_area || `${venue.state} - ${venue.city}`,
        lat: venue.lat || 0,
        lon: venue.lon || 0,
        airport_distance_mi: venue.airport_distance_mi || 0,
        capacity: venue.capacity || 0,
        meeting_rooms_total: venue.meeting_rooms_total || 0,
        total_meeting_area_sqft: venue.total_meeting_area_sqft || 0,
        largest_space_sqft: venue.largest_space_sqft || 0,
        amenities: venue.amenities || [],
        tags: venue.tags || [],
        ...venue
      };

      validatedVenues.push(defaultVenue);
    }

    const venuesFilePath = join(__dirname, '../../data/venues.json');
    const existingVenues = getVenuesFromJson();

    const existingIds = new Set(existingVenues.map((v: any) => v.venue_id));
    const duplicateIds = validatedVenues.filter(v => existingIds.has(v.venue_id));

    if (duplicateIds.length > 0) {
      return res.status(400).json({
        error: `Duplicate venue_ids found: ${duplicateIds.map(v => v.venue_id).join(', ')}`
      });
    }

    const updatedVenues = [...existingVenues, ...validatedVenues];

    const backupPath = join(__dirname, '../../data/venues_backup.json');
    writeFileSync(backupPath, JSON.stringify(existingVenues, null, 2));
    writeFileSync(venuesFilePath, JSON.stringify(updatedVenues, null, 2));

    res.json({
      success: true,
      message: `Successfully added ${validatedVenues.length} venue(s)`,
      added_venues: validatedVenues.length,
      total_venues: updatedVenues.length,
      venue_ids: validatedVenues.map(v => v.venue_id)
    });

  } catch (error) {
    console.error('Error appending venues:', error);
    res.status(500).json({
      error: 'Failed to append venues',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Smyth Reply Agent endpoint
router.post('/reply', async (req, res) => {
  try {
    const { user_text } = req.body;

    if (!user_text || typeof user_text !== 'string' || user_text.trim().length === 0) {
      return res.status(400).json({
        error: 'Request body must contain a non-empty "user_text" string'
      });
    }

    console.log('Calling Smyth Reply Agent with text:', user_text);

    const response = await fetch('https://cmfvy00gpxdpqo3wtm3zjmdtq.agent.pa.smyth.ai/api/results_text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_text: user_text.trim() })
    });

    if (!response.ok) {
      console.warn(`Smyth Agent API not available: ${response.status} ${response.statusText}`);
      const fallbackResponse = {
        success: true,
        agent_reply: "I'm here to help you find the perfect venue! The AI assistant is currently unavailable, but I can still help you search for venues. Try using our venue search to find options that match your requirements for location, capacity, and amenities.",
        response_type: 'fallback',
        timestamp: new Date().toISOString(),
        user_query: user_text,
        note: 'Fallback response - external agent temporarily unavailable'
      };
      return res.json(fallbackResponse);
    }

    const agentData = await response.json();
    console.log('Received agent response:', agentData);

    let formattedResponse;
    if (typeof agentData === 'string') {
      formattedResponse = {
        success: true,
        agent_reply: agentData,
        response_type: 'text',
        timestamp: new Date().toISOString(),
        user_query: user_text
      };
    } else if (agentData && typeof agentData === 'object') {
      formattedResponse = {
        success: true,
        agent_reply: (agentData as any).reply || (agentData as any).response || (agentData as any).message || JSON.stringify(agentData),
        response_type: 'structured',
        timestamp: new Date().toISOString(),
        user_query: user_text,
        raw_response: agentData
      };
    } else {
      formattedResponse = {
        success: true,
        agent_reply: 'Agent response received but could not be formatted',
        response_type: 'unknown',
        timestamp: new Date().toISOString(),
        user_query: user_text,
        raw_response: agentData
      };
    }

    res.json(formattedResponse);

  } catch (error) {
    console.error('Error calling Smyth Reply Agent:', error);
    const errorResponse = {
      success: false,
      error: 'Failed to get agent reply',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      user_query: req.body.user_text || 'Unknown'
    };
    res.status(500).json(errorResponse);
  }
});

// AI-powered venue search endpoint
router.post('/ai-search', async (req, res) => {
  try {
    const { venue_request , offset } = req.body;

    if (!venue_request) {
      return res.status(400).json({ error: 'venue_request is required' });
    }

    console.log('Calling SmythOS AI search with request:', venue_request);

    const response = await fetch('https://cmfvy00gpxdpqo3wtm3zjmdtq.agent.pa.smyth.ai/api/search_venues', {
      method: 'POST',
      headers: {
        'Accept': 'text/plain',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ venue_request , offset })
    });

    console.log('SmythOS API response status:', response.status);

    if (!response.ok) {
      if (response.status === 429) {
        console.log('Rate limit hit, waiting 2 seconds and retrying...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        const retryResponse = await fetch('https://cmfvy00gpxdpqo3wtm3zjmdtq.agent.pa.smyth.ai/api/search_venues', {
          method: 'POST',
          headers: {
            'Accept': 'text/plain',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ venue_request })
        });

        if (!retryResponse.ok) {
          throw new Error(`SmythOS API error after retry: ${retryResponse.status}`);
        }

        const apiData = await retryResponse.text();
        console.log('SmythOS API retry successful');
        return handleSmythOSResponse(apiData, venue_request, res);
      }

      throw new Error(`SmythOS API error: ${response.status}`);
    }

    const apiData = await response.text();
    console.log('SmythOS API response received (text):', apiData);
    return handleSmythOSResponse(apiData, venue_request, res);

  } catch (error) {
    console.error('Error in AI venue search:', error);
    res.status(500).json({
      error: 'Failed to search venues',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

function handleSmythOSResponse(apiData: string, venue_request: string, res: any) {
  try {
    console.log('Raw SmythOS response:', apiData);

    // The response is text/plain, so we need to parse it as JSON
    let searchResults;
    if (typeof apiData === 'string') {
      searchResults = JSON.parse(apiData);
    } else {
      console.error('API response is not a string:', typeof apiData);
      return res.status(500).json({ error: 'Invalid response format from search API' });
    }

    const venues = JSON.parse(searchResults.results).venues || [];
    const seenIds = new Set();
    const uniqueVenues = venues.filter((venue: any) => {
      if (seenIds.has(venue.venue_id)) return false;
      seenIds.add(venue.venue_id);
      return true;
    });

    const venuesWithVenueId = uniqueVenues.map((venue: any) => ({
      ...venue,
      venue_id: venue.id
    }));

    const formattedResponse = {
      venues: venuesWithVenueId,
      total: venuesWithVenueId.length,
      displayed: venuesWithVenueId.length,
      limit: searchResults.limit || 10,
      offset: searchResults.offset || 0,
      has_more: searchResults.has_more || false,
      search_query: venue_request
    };

    console.log(`SmythOS AI search found ${venuesWithVenueId.length} venues`);
    res.json(formattedResponse);
  } catch (parseError) {
    console.error('Error parsing SmythOS API results:', parseError);
    console.error('Raw API data:', apiData);
    return res.status(500).json({ error: 'Invalid response format from search API' });
  }
}

export default router;