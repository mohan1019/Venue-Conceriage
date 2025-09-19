import { Router } from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

// Load venues data for pricing
const venuesData = JSON.parse(
  readFileSync(join(__dirname, '../../data/venues.json'), 'utf-8')
);

router.get('/', (req, res) => {
  try {
    const { venueId, hours, guests, eventDate } = req.query;

    if (!venueId || !hours || !guests || !eventDate) {
      return res.status(400).json({
        error: 'Missing required parameters: venueId, hours, guests, eventDate'
      });
    }

    const venue = venuesData.find((v: any) => v.id === venueId);
    if (!venue) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    const numHours = Number(hours);
    const numGuests = Number(guests);
    const eventDateObj = new Date(eventDate.toString());

    if (numHours <= 0 || numGuests <= 0) {
      return res.status(400).json({ error: 'Hours and guests must be positive numbers' });
    }

    // Calculate quote according to rules
    let base = venue.pricePerHour * numHours;
    const fees: { name: string; amount: number }[] = [];
    const notes: string[] = [];

    // Cleaning fee for large events
    if (numGuests > 120) {
      fees.push({ name: 'Large Event Cleaning Fee', amount: 200 });
      notes.push('Additional cleaning fee applies for events over 120 guests');
    }

    // Weekend surcharge
    const dayOfWeek = eventDateObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
      const weekendSurcharge = base * 0.1;
      fees.push({ name: 'Weekend Surcharge (10%)', amount: weekendSurcharge });
      base = base * 1.1;
      notes.push('Weekend events include a 10% surcharge');
    }

    const subtotal = base;
    const totalFees = fees.reduce((sum, fee) => sum + fee.amount, 0);
    const total = Math.round(subtotal + totalFees);

    const quote = {
      venueId,
      venueName: venue.name,
      hours: numHours,
      guests: numGuests,
      eventDate: eventDate.toString(),
      subtotal: Math.round(subtotal),
      fees,
      total,
      notes,
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      currency: 'USD'
    };

    res.json(quote);
  } catch (error) {
    console.error('Error generating quote:', error);
    res.status(500).json({ error: 'Failed to generate quote' });
  }
});

export default router;