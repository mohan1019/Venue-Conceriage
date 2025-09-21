import { Router } from 'express';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

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
          venue.capacity
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

// Endpoint to append new venue data to venues.json
router.post('/append', (req, res) => {
  try {
    const { venues: newVenues } = req.body;

    // Validate request body
    if (!newVenues || !Array.isArray(newVenues)) {
      return res.status(400).json({
        error: 'Request body must contain a "venues" array'
      });
    }

    if (newVenues.length === 0) {
      return res.status(400).json({
        error: 'Venues array cannot be empty'
      });
    }

    // Validate each venue object
    const requiredFields = ['name', 'city', 'state'];
    const validatedVenues = [];

    for (let i = 0; i < newVenues.length; i++) {
      const venue = newVenues[i];

      // Check required fields
      for (const field of requiredFields) {
        if (!venue[field]) {
          return res.status(400).json({
            error: `Missing required field "${field}" in venue at index ${i}`
          });
        }
      }

      // Generate venue_id if not provided
      if (!venue.venue_id) {
        venue.venue_id = uuidv4();
      }

      // Set default values for missing optional fields
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
        rooms_total: venue.rooms_total || 0,
        meeting_rooms_total: venue.meeting_rooms_total || 0,
        total_meeting_area_sqft: venue.total_meeting_area_sqft || 0,
        largest_space_sqft: venue.largest_space_sqft || 0,
        second_largest_space_sqft: venue.second_largest_space_sqft || 0,
        largest_ceiling_height_ft: venue.largest_ceiling_height_ft || 0,
        diamond_level: venue.diamond_level || '',
        preferred_rating: venue.preferred_rating || '',
        year_built: venue.year_built || 0,
        year_renovated: venue.year_renovated || 0,
        main_image: venue.main_image || '',
        hero_image: venue.hero_image || '',
        listing_text: venue.listing_text || '',
        occ_total_theater: venue.occ_total_theater || 0,
        occ_total_banquet: venue.occ_total_banquet || 0,
        occ_total_classroom: venue.occ_total_classroom || 0,
        occ_largest_theater: venue.occ_largest_theater || 0,
        occ_largest_banquet: venue.occ_largest_banquet || 0,
        occ_largest_classroom: venue.occ_largest_classroom || 0,
        amenities: venue.amenities || '',
        tags: venue.tags || '',
        promotions: venue.promotions || '[]',
        need_dates: venue.need_dates || '[]',
        ...venue // Override with any additional fields provided
      };

      validatedVenues.push(defaultVenue);
    }

    // Read existing venues data
    const venuesFilePath = join(__dirname, '../../data/venues.json');
    const existingVenues = JSON.parse(readFileSync(venuesFilePath, 'utf-8'));

    // Check for duplicate venue_ids
    const existingIds = new Set(existingVenues.map((v: any) => v.venue_id));
    const duplicateIds = validatedVenues.filter(v => existingIds.has(v.venue_id));

    if (duplicateIds.length > 0) {
      return res.status(400).json({
        error: `Duplicate venue_ids found: ${duplicateIds.map(v => v.venue_id).join(', ')}`
      });
    }

    // Append new venues to existing data
    const updatedVenues = [...existingVenues, ...validatedVenues];

    // Write back to file with backup
    const backupPath = join(__dirname, '../../data/venues_backup.json');
    writeFileSync(backupPath, JSON.stringify(existingVenues, null, 2));
    writeFileSync(venuesFilePath, JSON.stringify(updatedVenues, null, 2));

    // Update in-memory cache
    venuesData.length = 0;
    venuesData.push(...updatedVenues);

    // Clear cache to force refresh
    cache.clear();

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

// AI-powered venue search endpoint
router.post('/ai-search', async (req, res) => {
  try {
    const { venue_request } = req.body;

    if (!venue_request) {
      return res.status(400).json({ error: 'venue_request is required' });
    }

    // Create cache key for AI search
    const cacheKey = `ai-search-${JSON.stringify({ venue_request })}`;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return res.json(cached.data);
    }

    // Call external AI search API
    const response = await fetch('https://cmfsj5xv5p9b62py5r1okplh2.agent.pa.smyth.ai/api/search_venues', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ venue_request })
    });

    if (!response.ok) {
      throw new Error(`External API error: ${response.status}`);
    }

    const apiData = await response.json();

    // Parse the nested JSON response
    let searchResults;
    try {
      searchResults = JSON.parse(apiData.results);
    } catch (parseError) {
      console.error('Error parsing API results:', parseError);
      return res.status(500).json({ error: 'Invalid response format from search API' });
    }

    // Format the response to match our frontend expectations
    const formattedResponse = {
      venues: searchResults.venues || [],
      total: searchResults.total || 0,
      displayed: searchResults.displayed || 0,
      limit: searchResults.limit || 10,
      offset: searchResults.offset || 0,
      has_more: searchResults.has_more || false,
      search_query: venue_request
    };

    // Cache the result
    cache.set(cacheKey, { data: formattedResponse, timestamp: Date.now() });

    res.json(formattedResponse);
  } catch (error) {
    console.error('Error in AI venue search:', error);
    res.status(500).json({
      error: 'Failed to search venues',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;