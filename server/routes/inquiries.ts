import { Router } from 'express';

const router = Router();

// In-memory storage for demo (use database in production)
const inquiries: any[] = [];

router.post('/', (req, res) => {
  try {
    const { venueId, name, email, eventDate, hours, guests, notes } = req.body;

    // Validation
    if (!venueId || !name || !email || !eventDate || !hours || !guests) {
      return res.status(400).json({ 
        error: 'Missing required fields: venueId, name, email, eventDate, hours, guests' 
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Date validation
    const eventDateObj = new Date(eventDate);
    if (eventDateObj <= new Date()) {
      return res.status(400).json({ error: 'Event date must be in the future' });
    }

    // Numeric validation
    if (hours <= 0 || guests <= 0) {
      return res.status(400).json({ error: 'Hours and guests must be positive numbers' });
    }

    const inquiry = {
      id: Math.random().toString(36).substr(2, 9),
      venueId,
      name,
      email,
      eventDate,
      hours: Number(hours),
      guests: Number(guests),
      notes: notes || '',
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    inquiries.push(inquiry);

    res.status(201).json({
      message: 'Inquiry submitted successfully',
      inquiry: {
        id: inquiry.id,
        status: inquiry.status,
        createdAt: inquiry.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating inquiry:', error);
    res.status(500).json({ error: 'Failed to submit inquiry' });
  }
});

export default router;