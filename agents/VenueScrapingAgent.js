import 'dotenv/config';

export default class VenueScrapingAgent {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY;
    this.baseUrl = 'https://api.groq.com/openai/v1/chat/completions';
  }

  async prompt(message) {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: message }],
          temperature: 0.3,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error calling Groq API:', error);
      throw error;
    }
  }

  async searchVenueSources(region) {
    try {
      // This would normally use a web search API
      // For now, returning mock sources
      return {
        results: [
          { url: `https://www.${region.toLowerCase()}.com/venues`, title: `${region} Official Tourism` },
          { url: `https://www.convention-centers-${region.toLowerCase()}.com`, title: `${region} Convention Centers` },
          { url: `https://www.hotels-${region.toLowerCase()}.com/meetings`, title: `${region} Meeting Hotels` }
        ]
      };
    } catch (error) {
      console.error('Error searching venue sources:', error);
      return { error: 'Failed to search venue sources' };
    }
  }

  async extractVenueUrls(searchResults, region) {
    try {
      const prompt = `Extract venue URLs from these search results for ${region}:

${JSON.stringify(searchResults)}

Find URLs for:
- Tourism boards with venue/meeting listings
- Convention centers
- Hotels with meeting facilities
- Event venues
- City open data portals

Return JSON array of URLs to scrape:
{"venue_urls": ["url1", "url2", ...]}`;

      const result = await this.prompt(prompt);
      // Clean response to extract only JSON
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { venue_urls: [] };
    } catch (error) {
      console.error('Error extracting venue URLs:', error);
      return { venue_urls: [] };
    }
  }

  async queryOverpassAPI(city) {
    try {
      const query = `[out:json][timeout:30];
(
  node["tourism"="hotel"]["addr:city"~"${city}",i];
  way["tourism"="hotel"]["addr:city"~"${city}",i];
  node["amenity"="conference_centre"]["addr:city"~"${city}",i];
  way["amenity"="conference_centre"]["addr:city"~"${city}",i];
  node["leisure"="events_venue"]["addr:city"~"${city}",i];
  way["leisure"="events_venue"]["addr:city"~"${city}",i];
);
out geom;`;

      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: query
      });

      if (!response.ok) {
        throw new Error(`Overpass API error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error querying Overpass API:', error);
      return { elements: [] };
    }
  }

  async scrapeVenueData(urls) {
    try {
      // Mock scraping since we can't actually scrape in this environment
      const mockVenues = urls.map((url, index) => ({
        source_url: url,
        venue_data: {
          venue_id: `venue_${index + 1}`,
          name: `Venue ${index + 1}`,
          type: 'HOTEL',
          city: 'Sample City',
          state: 'Sample State',
          country: 'Sample Country',
          capacity: 100 + (index * 50),
          amenities: 'HIGH_SPEED_INTERNET, ONSITE_CATERING'
        }
      }));

      return mockVenues;
    } catch (error) {
      console.error('Error scraping venue data:', error);
      return [];
    }
  }

  async normalizeVenueData(htmlContent) {
    try {
      const prompt = `Extract venue data from this HTML content and normalize to EXACT schema:

${htmlContent}

Required JSON schema (all fields required):
{
  "venue_id": "string",  // Generate UUID5 from name+city+state+country
  "name": "string",
  "brand": "string|null",
  "type": "LUXURY_HOTEL|HOTEL|CONVENTION_CENTER|EVENT_SPACE|EVENT_VENUE",
  "city": "string",
  "state": "string",
  "country": "string",
  "metro_area": "string|null",
  "lat": "number",
  "lon": "number",
  "capacity": "number|null",
  "meeting_rooms_total": "number|null",
  "total_meeting_area_sqft": "number|null",
  "amenities": "string",  // comma+space joined UPPER_SNAKE
  "tags": "string"       // comma+space joined
}

Extract from JSON-LD first, then DOM fallback. Infer type from brand/content.`;

      const result = await this.prompt(prompt);
      // Clean response to extract only JSON
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { venue_urls: [] };
    } catch (error) {
      console.error('Error normalizing venue data:', error);
      return null;
    }
  }

  async uploadToBackend(venueData, backendUrl) {
    try {
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(venueData)
      });

      if (!response.ok) {
        throw new Error(`Backend upload error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error uploading to backend:', error);
      return { error: 'Failed to upload to backend' };
    }
  }

  async scrapeVenues(region, backendApiUrl) {
    try {
      // Step 1: Search for venue sources
      const searchResults = await this.searchVenueSources(region);

      // Step 2: Extract venue URLs
      const urlData = await this.extractVenueUrls(searchResults, region);

      // Step 3: Query OpenStreetMap for additional venues
      const osmData = await this.queryOverpassAPI(region);

      // Step 4: Scrape venue pages
      const scrapedVenues = await this.scrapeVenueData(urlData.venue_urls || []);

      // Step 5: Deduplicate and process
      const uniqueVenues = this.deduplicateVenues(scrapedVenues);

      // Step 6: Upload to backend
      const uploadResult = await this.uploadToBackend(
        { venues: uniqueVenues },
        backendApiUrl
      );

      // Step 7: Generate summary
      const summary = {
        found: scrapedVenues.length,
        normalized: uniqueVenues.length,
        upserted: uploadResult.upserted || 0,
        skipped: uploadResult.skipped || 0,
        errors_count: uploadResult.errors || 0,
        sample_ids: uniqueVenues.slice(0, 3).map(v => v.venue_data?.venue_id).filter(Boolean)
      };

      return {
        status: 'success',
        summary: summary,
        venues: uniqueVenues,
        osm_data: osmData
      };

    } catch (error) {
      console.error('Error in venue scraping:', error);
      return {
        error: 'Failed to scrape venues',
        region: region
      };
    }
  }

  deduplicateVenues(venues) {
    const unique = [];
    const seen = new Set();

    for (const venue of venues) {
      if (!venue.venue_data?.name) continue;

      const key = `${venue.venue_data.name.toLowerCase().trim()}_${venue.venue_data.city?.toLowerCase().trim()}`;

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(venue);
      }

      if (unique.length >= 50) break;
    }

    return unique;
  }
}