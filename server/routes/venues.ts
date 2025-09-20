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

// New POST endpoint for advanced venue search
router.post('/search', (req, res) => {
  try {
    const {
      city,
      state,
      metro_area,
      capacity_min,
      amenities,
      limit = 10,
      offset = 0,
      fallback = false
    } = req.body;

    // Create cache key
    const cacheKey = JSON.stringify({ city, state, metro_area, capacity_min, amenities, limit, offset, fallback });
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return res.json(cached.data);
    }

    let filteredVenues = [...venuesData];

    // Apply filters based on provided criteria
    if (city) {
      filteredVenues = filteredVenues.filter(venue =>
        venue.city?.toLowerCase() === city.toLowerCase()
      );
    }

    if (state) {
      filteredVenues = filteredVenues.filter(venue =>
        venue.state?.toLowerCase() === state.toLowerCase()
      );
    }

    if (metro_area) {
      filteredVenues = filteredVenues.filter(venue =>
        venue.metro_area?.toLowerCase() === metro_area.toLowerCase()
      );
    }

    if (capacity_min) {
      filteredVenues = filteredVenues.filter(venue => {
        // Check various capacity fields that might exist
        const maxCapacity = Math.max(
          venue.occ_total_theater || 0,
          venue.occ_total_banquet || 0,
          venue.occ_total_classroom || 0,
          venue.occ_largest_theater || 0,
          venue.occ_largest_banquet || 0,
          venue.occ_largest_classroom || 0
        );
        return maxCapacity >= capacity_min;
      });
    }

    if (amenities && Array.isArray(amenities) && amenities.length > 0) {
      filteredVenues = filteredVenues.filter(venue => {
        if (!venue.amenities) return false;

        // Split amenities string into array if it's a string
        const venueAmenities = typeof venue.amenities === 'string'
          ? venue.amenities.split(',').map((a: string) => a.trim().toUpperCase())
          : venue.amenities;

        // Check if all required amenities are present
        return amenities.every((requiredAmenity: string) =>
          venueAmenities.some((venueAmenity: string) =>
            venueAmenity.toUpperCase().includes(requiredAmenity.toUpperCase())
          )
        );
      });
    }

    // If no results and fallback is true, try less strict filtering
    if (filteredVenues.length === 0 && fallback) {
      filteredVenues = [...venuesData];

      // Apply more lenient filters
      if (state) {
        filteredVenues = filteredVenues.filter(venue =>
          venue.state?.toLowerCase() === state.toLowerCase()
        );
      }

      if (capacity_min) {
        // Use 80% of requested capacity as fallback
        const fallbackCapacity = Math.floor(capacity_min * 0.8);
        filteredVenues = filteredVenues.filter(venue => {
          const maxCapacity = Math.max(
            venue.occ_total_theater || 0,
            venue.occ_total_banquet || 0,
            venue.occ_total_classroom || 0,
            venue.occ_largest_theater || 0,
            venue.occ_largest_banquet || 0,
            venue.occ_largest_classroom || 0
          );
          return maxCapacity >= fallbackCapacity;
        });
      }
    }

    // Sort by relevance (prefer venues with more amenities, higher capacity)
    filteredVenues.sort((a, b) => {
      // Calculate relevance score
      const scoreA = (a.occ_total_theater || 0) + (a.amenities?.split(',').length || 0);
      const scoreB = (b.occ_total_theater || 0) + (b.amenities?.split(',').length || 0);
      return scoreB - scoreA;
    });

    // Apply pagination
    const total = filteredVenues.length;
    const paginatedVenues = filteredVenues.slice(offset, offset + limit);

    const result = {
      venues: paginatedVenues,
      total,
      displayed: paginatedVenues.length,
      limit,
      offset,
      has_more: offset + limit < total
    };

    // Cache the result
    cache.set(cacheKey, { data: result, timestamp: Date.now() });

    res.json(result);
  } catch (error) {
    console.error('Error searching venues:', error);
    res.status(500).json({ error: 'Failed to search venues' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const venue = venuesData.find((v: any) => v.venue_id === id);

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