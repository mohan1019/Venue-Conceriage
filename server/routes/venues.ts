import { Router } from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import { sql } from '../db/connection-postgres.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Database helper functions
const getCachedData = async (cacheKey: string) => {
  try {
    const result = await sql`
      SELECT data FROM search_cache WHERE cache_key = ${cacheKey} AND expires_at > NOW()
    `;
    return result[0]?.data || null;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
};

const setCachedData = async (cacheKey: string, data: any) => {
  try {
    const expiresAt = new Date(Date.now() + CACHE_DURATION);
    await sql`
      INSERT INTO search_cache (cache_key, data, expires_at)
      VALUES (${cacheKey}, ${JSON.stringify(data)}, ${expiresAt})
      ON CONFLICT (cache_key)
      DO UPDATE SET data = ${JSON.stringify(data)}, expires_at = ${expiresAt}
    `;
  } catch (error) {
    console.error('Cache set error:', error);
  }
};

router.get('/', async (req, res) => {
  try {
    const { query, city, minCapacity, maxPricePerHour, amenities } = req.query;

    // Create cache key
    const cacheKey = JSON.stringify({ query, city, minCapacity, maxPricePerHour, amenities });
    const cached = await getCachedData(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // Build SQL query with filters
    let sqlQuery = 'SELECT * FROM venues WHERE 1=1';
    const queryParams: any[] = [];
    let paramCount = 0;

    // Apply filters
    if (query) {
      paramCount++;
      const searchTerm = `%${query.toString().toLowerCase()}%`;
      sqlQuery += ` AND (LOWER(name) LIKE $${paramCount} OR LOWER(city) LIKE $${paramCount} OR EXISTS (
        SELECT 1 FROM unnest(amenities) as amenity WHERE LOWER(amenity) LIKE $${paramCount}
      ))`;
      queryParams.push(searchTerm);
    }

    if (city) {
      paramCount++;
      sqlQuery += ` AND LOWER(city) = $${paramCount}`;
      queryParams.push(city.toString().toLowerCase());
    }

    if (minCapacity) {
      paramCount++;
      sqlQuery += ` AND capacity >= $${paramCount}`;
      queryParams.push(parseInt(minCapacity.toString()));
    }

    if (maxPricePerHour) {
      paramCount++;
      sqlQuery += ` AND (price_per_hour <= $${paramCount} OR hourly_rate <= $${paramCount})`;
      queryParams.push(parseInt(maxPricePerHour.toString()));
    }

    if (amenities) {
      const requiredAmenities = amenities.toString().split(',').map(a => a.trim().toLowerCase());
      for (const amenity of requiredAmenities) {
        paramCount++;
        sqlQuery += ` AND EXISTS (
          SELECT 1 FROM unnest(amenities) as venue_amenity WHERE LOWER(venue_amenity) LIKE $${paramCount}
        )`;
        queryParams.push(`%${amenity}%`);
      }
    }

    // Add ordering and limit
    sqlQuery += ' ORDER BY capacity DESC LIMIT 5';

    // Execute query
    const venues = await sql.unsafe(sqlQuery, queryParams);

    // Add venue_id field for frontend compatibility
    const venuesWithVenueId = venues.map((venue: any) => ({
      ...venue,
      venue_id: venue.id
    }));

    const responseData = {
      venues: venuesWithVenueId,
      total: venuesWithVenueId.length,
      displayed: venuesWithVenueId.length
    };

    // Cache the result
    await setCachedData(cacheKey, responseData);

    res.json(responseData);
  } catch (error) {
    console.error('Error fetching venues:', error);
    res.status(500).json({ error: 'Failed to fetch venues' });
  }
});

// New POST endpoint for advanced venue search
router.post('/search', async (req, res) => {
  try {
    const {
      city,
      state,
      country,
      metro_area,
      // capacity
      capacity_min,
      capacity_max,
      // classification
      type,
      // arrays
      amenities,
      tags,
      // ratings
      diamond_level,
      preferred_rating,
      // spatial
      lat,
      lon,
      radius_mi,
      airport_distance_max_mi,
      // spaces
      meeting_rooms_total,
      total_meeting_area_sqft,
      largest_space_sqft,
      // price (if present in dataset)
      price_per_hour_min,
      price_per_hour_max,
      // dates (ISO strings). If provided, we’ll prefer venues with promotions that overlap.
      dates,
      // pagination / behavior
      limit = 10,
      offset = 0,
      fallback = false
    } = req.body || {};

    // ---- Helpers ----
    const toStr = (v: any) => (typeof v === 'string' ? v : (v ?? '') + '');
    const ciEq = (a: any, b: any) => toStr(a).trim().toLowerCase() === toStr(b).trim().toLowerCase();
    const ciIncludes = (hay: any, needle: any) => toStr(hay).toLowerCase().includes(toStr(needle).toLowerCase());
    const asUpperArray = (v: any) => {
      if (!v) return [];
      if (Array.isArray(v)) return v.map(x => toStr(x).trim().toUpperCase()).filter(Boolean);
      return toStr(v).split(',').map(x => x.trim().toUpperCase()).filter(Boolean);
    };
    const parsePromotions = (p: any) => {
      // promotions may be a JSON string of [{title,start,end}...]
      if (!p) return [];
      if (Array.isArray(p)) return p;
      try { return JSON.parse(p); } catch { return []; }
    };
    const parseDates = (arr: any) => {
      if (!arr || !Array.isArray(arr)) return [];
      return arr
        .map(d => {
          // support "YYYY-MM-DD" or ranges "YYYY-MM-DD to YYYY-MM-DD"
          const s = toStr(d);
          if (s.includes('to')) {
            const [start, end] = s.split('to').map(x => x.trim());
            return { start: new Date(start), end: new Date(end) };
          }
          const dt = new Date(s);
          return { start: dt, end: dt };
        })
        .filter(({ start, end }: any) => !isNaN(start.getTime()) && !isNaN(end.getTime()));
    };
    const datesRequested = parseDates(dates);

    const haversineMi = (lat1: any, lon1: any, lat2: any, lon2: any) => {
      const toRad = (x: any) => (x * Math.PI) / 180;
      const R = 3958.8; // miles
      const dLat = toRad((lat2 ?? 0) - (lat1 ?? 0));
      const dLon = toRad((lon2 ?? 0) - (lon1 ?? 0));
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1 ?? 0)) *
          Math.cos(toRad(lat2 ?? 0)) *
          Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    // Build cache key with all supported params (sorted keys for stability)
    const cachePayload = {
      city, state, country, metro_area,
      capacity_min, capacity_max, type,
      amenities, tags,
      diamond_level, preferred_rating,
      lat, lon, radius_mi, airport_distance_max_mi,
      meeting_rooms_total, total_meeting_area_sqft, largest_space_sqft,
      price_per_hour_min, price_per_hour_max,
      dates: datesRequested.map(({ start, end }) => [start.toISOString(), end.toISOString()])
      // limit, offset, fallback
    };
    const cacheKey = JSON.stringify(cachePayload);
    const cached = await getCachedData(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Get venues from database
    let filteredVenues: any[] = await sql`SELECT * FROM venues`;

    // ---- Filters ----
    if (city) {
      filteredVenues = filteredVenues.filter(v => {
        // Enhanced city matching to handle spacing variations
        const venueCityNormalized = toStr(v.city).replace(/\s+/g, '').toLowerCase();
        const searchCityNormalized = toStr(city).replace(/\s+/g, '').toLowerCase();

        // Try both exact match and space-removed match
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
      // partial match to be forgiving (e.g., "Seattle" vs "WA - Seattle")
      filteredVenues = filteredVenues.filter(v => ciIncludes(v.metro_area, metro_area));
    }

    if (typeof capacity_min === 'number') {
      filteredVenues = filteredVenues.filter(v => {
        const cap = Number(v.capacity ?? 0);
        return cap >= capacity_min;
      });
    }

    if (typeof capacity_max === 'number') {
      filteredVenues = filteredVenues.filter(v => {
        const cap = Number(v.capacity ?? 0);
        return cap > 0 ? cap <= capacity_max : true;
      });
    }

    if (type) {
      filteredVenues = filteredVenues.filter(v => ciEq(v.type, type));
    }

    if (amenities && Array.isArray(amenities) && amenities.length > 0) {
      const requestedAmenities = asUpperArray(amenities);
      filteredVenues = filteredVenues.filter(v => {
        const venueAmenities = asUpperArray(v.amenities);
        // require ALL requested amenities - more forgiving matching
        return requestedAmenities.every(req => {
          return venueAmenities.some(va => {
            // Bidirectional partial matching:
            // 1. "bus" matches "BUS_PARKING_AVAILABLE" (req contained in venue)
            // 2. "bus parking" matches "BUS_PARKING_AVAILABLE" (words from req in venue)
            const reqNormalized = req.replace(/[_\s-]/g, ' ').toLowerCase();
            const vaNormalized = va.replace(/[_\s-]/g, ' ').toLowerCase();

            // Simple contains check (existing behavior)
            if (vaNormalized.includes(reqNormalized) || reqNormalized.includes(vaNormalized)) {
              return true;
            }

            // Word-based matching for better fuzzy search
            const reqWords = reqNormalized.split(/\s+/).filter(Boolean);
            const vaWords = vaNormalized.split(/\s+/).filter(Boolean);

            // Check if all words from request appear in venue amenity
            return reqWords.every(reqWord =>
              vaWords.some(vaWord =>
                vaWord.includes(reqWord) || reqWord.includes(vaWord)
              )
            );
          });
        });
      });
    }

    if (tags && Array.isArray(tags) && tags.length > 0) {
      const requestedTags = asUpperArray(tags);
      filteredVenues = filteredVenues.filter(v => {
        const venueTags = asUpperArray(v.tags);
        return requestedTags.every(req => venueTags.some(t => t.includes(req)));
      });
    }

    if (diamond_level) {
      filteredVenues = filteredVenues.filter(v => ciEq(v.diamond_level, diamond_level));
    }

    if (preferred_rating) {
      filteredVenues = filteredVenues.filter(v => ciEq(v.preferred_rating, preferred_rating));
    }

    if (typeof meeting_rooms_total === 'number') {
      filteredVenues = filteredVenues.filter(v => Number(v.meeting_rooms_total ?? 0) >= meeting_rooms_total);
    }

    if (typeof total_meeting_area_sqft === 'number') {
      filteredVenues = filteredVenues.filter(v => Number(v.total_meeting_area_sqft ?? 0) >= total_meeting_area_sqft);
    }

    if (typeof largest_space_sqft === 'number') {
      filteredVenues = filteredVenues.filter(v => Number(v.largest_space_sqft ?? 0) >= largest_space_sqft);
    }

    if (typeof airport_distance_max_mi === 'number') {
      filteredVenues = filteredVenues.filter(v => {
        const dist = Number(v.airport_distance_mi ?? Infinity);
        return dist <= airport_distance_max_mi;
      });
    }

    if (lat != null && lon != null && typeof radius_mi === 'number' && radius_mi > 0) {
      filteredVenues = filteredVenues.filter(v => {
        if (v.lat == null || v.lon == null) return false;
        const d = haversineMi(Number(lat), Number(lon), Number(v.lat), Number(v.lon));
        return d <= radius_mi;
      });
    }

    // Price filters only if those fields exist in your dataset
    if (typeof price_per_hour_min === 'number' || typeof price_per_hour_max === 'number') {
      filteredVenues = filteredVenues.filter(v => {
        const price = Number(v.price_per_hour ?? v.hourly_rate ?? NaN);
        if (Number.isNaN(price)) return false; // skip if price unknown
        if (typeof price_per_hour_min === 'number' && price < price_per_hour_min) return false;
        if (typeof price_per_hour_max === 'number' && price > price_per_hour_max) return false;
        return true;
      });
    }

    // If no results and fallback is true, relax some constraints
    if (filteredVenues.length === 0 && fallback) {
      filteredVenues = await sql`SELECT * FROM venues` as any[];

      if (state) {
        filteredVenues = filteredVenues.filter(v => ciEq(v.state, state));
      } else if (country) {
        filteredVenues = filteredVenues.filter(v => ciEq(v.country, country));
      }

      if (typeof capacity_min === 'number') {
        const fbCap = Math.floor(capacity_min * 0.8);
        filteredVenues = filteredVenues.filter(v => Number(v.capacity ?? 0) >= fbCap);
      }

      if (amenities && amenities.length > 0) {
        const requestedAmenities = asUpperArray(amenities);
        // relaxed: match ANY instead of ALL
        filteredVenues = filteredVenues.filter(v => {
          const venueAmenities = asUpperArray(v.amenities);
          return requestedAmenities.some(req => venueAmenities.some(va => va.includes(req)));
        });
      }
    }

    // ---- Scoring / Sorting ----
    // Score components:
    // + (# of amenity matches)
    // + capacity closeness (penalize difference from mid of [min,max])
    // + promo overlap bonus if dates requested
    // + inverse airport distance (closer is better)
    const requestedAmenities = asUpperArray(amenities);
    const hasCapRange = typeof capacity_min === 'number' || typeof capacity_max === 'number';
    const targetCap = (() => {
      if (typeof capacity_min === 'number' && typeof capacity_max === 'number') {
        return (capacity_min + capacity_max) / 2;
      } else if (typeof capacity_min === 'number') {
        return capacity_min;
      } else if (typeof capacity_max === 'number') {
        return capacity_max;
      }
      return null;
    })();

    const hasDateReq = datesRequested.length > 0;

    const overlapDates = (promos: any, reqRanges: any) => {
      if (!promos.length || !reqRanges.length) return false;
      return reqRanges.some(({ start: rs, end: re }: any) =>
        promos.some((p: any) => {
          const ps = new Date(p.start);
          const pe = new Date(p.end);
          if (isNaN(ps.getTime()) || isNaN(pe.getTime())) return false;
          return ps.getTime() <= re.getTime() && pe.getTime() >= rs.getTime(); // overlap
        })
      );
    };

    filteredVenues.sort((a, b) => {
      const aAmenities = asUpperArray(a.amenities);
      const bAmenities = asUpperArray(b.amenities);

      const amenityMatchesA = requestedAmenities.length
        ? requestedAmenities.filter(req => aAmenities.some(va => va.includes(req))).length
        : 0;
      const amenityMatchesB = requestedAmenities.length
        ? requestedAmenities.filter(req => bAmenities.some(vb => vb.includes(req))).length
        : 0;

      const capA = Number(a.capacity ?? 0);
      const capB = Number(b.capacity ?? 0);

      let capScoreA = 0, capScoreB = 0;
      if (hasCapRange && targetCap != null) {
        // negative of distance to target (closer is better)
        capScoreA = -Math.abs(capA - targetCap) / (targetCap || 1);
        capScoreB = -Math.abs(capB - targetCap) / (targetCap || 1);
      }

      const promosA = parsePromotions(a.promotions);
      const promosB = parsePromotions(b.promotions);
      const promoBonusA = hasDateReq && overlapDates(promosA, datesRequested) ? 1 : 0;
      const promoBonusB = hasDateReq && overlapDates(promosB, datesRequested) ? 1 : 0;

      const airportA = Number(a.airport_distance_mi ?? 999);
      const airportB = Number(b.airport_distance_mi ?? 999);
      const airportScoreA = -airportA / 100; // small weight
      const airportScoreB = -airportB / 100;

      const scoreA = amenityMatchesA * 2 + capScoreA + promoBonusA + airportScoreA;
      const scoreB = amenityMatchesB * 2 + capScoreB + promoBonusB + airportScoreB;

      return scoreB - scoreA;
    });

    // ---- Deduplication ----
    // Remove duplicate venues by id (keep first occurrence after sorting)
    const seenIds = new Set();
    const uniqueVenues = filteredVenues.filter(venue => {
      if (seenIds.has(venue.id)) {
        return false;
      }
      seenIds.add(venue.id);
      return true;
    });

    // ---- Pagination ----
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

    // Cache
    await setCachedData(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Error searching venues:', error);
    res.status(500).json({ error: 'Failed to search venues' });
  }
});


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
        contextText = contextText ?
          `${contextText} in ${city}` :
          `Found ${totalCount} venues in ${city}`;
        searchInsights.push(`Location: ${city}`);
      }
    }

    if (searchQuery.includes('catering') || searchQuery.includes('food') || searchQuery.includes('dining')) {
      searchInsights.push('🍽️ Catering available');
    }

    if (searchQuery.includes('parking')) {
      searchInsights.push('🅿️ Parking included');
    }

    if (searchQuery.includes('wifi') || searchQuery.includes('internet')) {
      searchInsights.push('📶 WiFi available');
    }

    if (searchQuery.includes('wheelchair') || searchQuery.includes('accessible')) {
      searchInsights.push('♿ Wheelchair accessible');
    }

    if (searchQuery.includes('av equipment') || searchQuery.includes('audio visual')) {
      searchInsights.push('🎥 AV equipment available');
    }

    if (searchQuery.includes('wedding') || searchQuery.includes('reception')) {
      searchInsights.push('💒 Wedding venues');
    }

    if (searchQuery.includes('corporate') || searchQuery.includes('business') || searchQuery.includes('conference')) {
      searchInsights.push('💼 Corporate events');
    }

    if (searchQuery.includes('luxury') || searchQuery.includes('upscale') || searchQuery.includes('premium')) {
      searchInsights.push('⭐ Luxury venues');
    }

    if (searchQuery.includes('outdoor') || searchQuery.includes('garden') || searchQuery.includes('patio')) {
      searchInsights.push('🌿 Outdoor spaces');
    }

    if (searchQuery.includes('downtown') || searchQuery.includes('city center')) {
      searchInsights.push('🏙️ Downtown location');
    }

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

    // Search quality insights
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

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const venues = await sql`SELECT * FROM venues WHERE id = ${id}`;
    const venue = venues[0];

    if (!venue) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    // Add venue_id field for frontend compatibility
    const venueWithVenueId = {
      ...venue,
      venue_id: venue.id
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

    // Data now stored in database - no need to update in-memory cache

    // Clear cache to force refresh
    // Cache cleared automatically by database

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

    // Validate request body
    if (!user_text || typeof user_text !== 'string' || user_text.trim().length === 0) {
      return res.status(400).json({
        error: 'Request body must contain a non-empty "user_text" string'
      });
    }

    // Create cache key for agent replies
    const cacheKey = `agent-reply-${JSON.stringify({ user_text })}`;
    const cached = await getCachedData(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    console.log('Calling Smyth Reply Agent with text:', user_text);

    // Call Smyth Reply Agent API
    const response = await fetch('https://cmfvy00gpxdpqo3wtm3zjmdtq.agent.pa.smyth.ai/api/results_text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_text: user_text.trim()
      })
    });

    if (!response.ok) {
      // If the external API is not working, provide a helpful fallback response
      console.warn(`Smyth Agent API not available: ${response.status} ${response.statusText}`);

      const fallbackResponse = {
        success: true,
        agent_reply: "I'm here to help you find the perfect venue! The AI assistant is currently unavailable, but I can still help you search for venues. Try using our venue search to find options that match your requirements for location, capacity, and amenities.",
        response_type: 'fallback',
        timestamp: new Date().toISOString(),
        user_query: user_text,
        note: 'Fallback response - external agent temporarily unavailable'
      };

      // Cache the fallback result briefly
      await setCachedData(cacheKey, { data: fallbackResponse, timestamp: Date.now() });
      return res.json(fallbackResponse);
    }

    const agentData = await response.json();
    console.log('Received agent response:', agentData);

    // Format the response for frontend consumption
    let formattedResponse;

    // Check if the response has a specific structure or is just text
    if (typeof agentData === 'string') {
      formattedResponse = {
        success: true,
        agent_reply: agentData,
        response_type: 'text',
        timestamp: new Date().toISOString(),
        user_query: user_text
      };
    } else if (agentData && typeof agentData === 'object') {
      // If it's an object, preserve the structure but add our metadata
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

    // Cache the result
    await setCachedData(cacheKey, { data: formattedResponse, timestamp: Date.now() });

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
    const { venue_request } = req.body;

    if (!venue_request) {
      return res.status(400).json({ error: 'venue_request is required' });
    }

    // Create cache key for AI search
    const cacheKey = `ai-search-${JSON.stringify({ venue_request })}`;
    const cached = await getCachedData(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // Call external AI search API
    const response = await fetch('https://cmfvy00gpxdpqo3wtm3zjmdtq.agent.pa.smyth.ai/api/search_venues', {
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
      const resultsData = (apiData as any).results;
      if (!resultsData || typeof resultsData !== 'string') {
        console.error('API results is undefined or not a string:', resultsData);
        return res.status(500).json({ error: 'No results data from search API' });
      }
      searchResults = JSON.parse(resultsData);
    } catch (parseError) {
      console.error('Error parsing API results:', parseError);
      console.error('Raw API data:', apiData);
      return res.status(500).json({ error: 'Invalid response format from search API' });
    }

    // Deduplicate venues by id before formatting response
    const venues = searchResults.venues || [];
    const seenIds = new Set();
    const uniqueVenues = venues.filter((venue: any) => {
      if (seenIds.has(venue.id)) {
        return false;
      }
      seenIds.add(venue.id);
      return true;
    });

    // Add venue_id field for frontend compatibility
    const venuesWithVenueId = uniqueVenues.map((venue: any) => ({
      ...venue,
      venue_id: venue.id
    }));

    // Format the response to match our frontend expectations
    const formattedResponse = {
      venues: venuesWithVenueId,
      total: venuesWithVenueId.length,
      displayed: venuesWithVenueId.length,
      limit: searchResults.limit || 10,
      offset: searchResults.offset || 0,
      has_more: searchResults.has_more || false,
      search_query: venue_request
    };

    // Cache the result
    await setCachedData(cacheKey, { data: formattedResponse, timestamp: Date.now() });

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