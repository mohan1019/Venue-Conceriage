import { Router } from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

// In-memory cache for venue searches
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Load venues data
const venuesData = JSON.parse(
  readFileSync(join(__dirname, '../../data/venues.json'), 'utf-8')
);

router.get('/', (req, res) => {
  try {
    const { query, city, minCapacity, maxPricePerHour, amenities } = req.query;
    
    // Create cache key
    const cacheKey = JSON.stringify({ query, city, minCapacity, maxPricePerHour, amenities });
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return res.json(cached.data);
    }

    let filteredVenues = [...venuesData];

    // Apply filters
    if (query) {
      const searchTerm = query.toString().toLowerCase();
      filteredVenues = filteredVenues.filter(venue =>
        venue.name.toLowerCase().includes(searchTerm) ||
        venue.city.toLowerCase().includes(searchTerm) ||
        venue.amenities.some((amenity: string) => 
          amenity.toLowerCase().includes(searchTerm)
        )
      );
    }

    if (city) {
      filteredVenues = filteredVenues.filter(venue =>
        venue.city.toLowerCase() === city.toString().toLowerCase()
      );
    }

    if (minCapacity) {
      filteredVenues = filteredVenues.filter(venue =>
        venue.capacity >= parseInt(minCapacity.toString())
      );
    }

    if (maxPricePerHour) {
      filteredVenues = filteredVenues.filter(venue =>
        venue.pricePerHour <= parseInt(maxPricePerHour.toString())
      );
    }

    if (amenities) {
      const requiredAmenities = amenities.toString().split(',').map(a => a.trim().toLowerCase());
      filteredVenues = filteredVenues.filter(venue =>
        requiredAmenities.every(required =>
          venue.amenities.some((amenity: string) =>
            amenity.toLowerCase().includes(required)
          )
        )
      );
    }

    // Limit results to top 5 for performance
    const limitedResults = filteredVenues
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5);

    const result = {
      venues: limitedResults,
      total: filteredVenues.length,
      displayed: limitedResults.length
    };

    // Cache the result
    cache.set(cacheKey, { data: result, timestamp: Date.now() });

    res.json(result);
  } catch (error) {
    console.error('Error fetching venues:', error);
    res.status(500).json({ error: 'Failed to fetch venues' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const venue = venuesData.find((v: any) => v.id === id);
    
    if (!venue) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    res.json(venue);
  } catch (error) {
    console.error('Error fetching venue:', error);
    res.status(500).json({ error: 'Failed to fetch venue' });
  }
});

export default router;