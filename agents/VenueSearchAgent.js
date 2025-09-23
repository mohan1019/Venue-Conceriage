import 'dotenv/config';

export default class VenueSearchAgent {
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
          max_tokens: 1000
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

  async searchVenues(venueRequest) {
    try {
      const today = new Date().toISOString().split('T')[0];

      const prompt = `Extract venue search parameters from this request: ${venueRequest}

Today's date for reference: ${today}

Rules:
- Include only the following fields if they are explicitly mentioned in the query:
  - type (venue type)
  - limit (number of results, default = 6 if not mentioned)
  - city (city name or abbreviation)
  - state
  - country
  - capacity_min
  - capacity_max
  - amenities (array of UPPERCASE codes)
  - dates (array of ISO strings or ranges, e.g. "2025-05-10" or "2025-06-01 to 2025-06-03")
  - price_per_hour_min
  - price_per_hour_max

City/State normalization:
- "nyc", "newyork" → city="New York", state="NY"
- "sf", "san fran" → city="San Francisco", state="CA"

Amenity examples: AUDIOVIDEO_CAPABILITIES, HIGH_SPEED_INTERNET, COMPLIMENTARY_PARKING_PROVIDED, ONSITE_CATERING, OUTDOOR_SPACE, WHEELCHAIR_ACCESSIBLE

Return ONLY well-formed JSON with the extracted parameters.

Examples:
Input: "Looking for a wedding hall in Seattle for at least 150 guests."
Output: {"type":"Wedding","limit":6,"city":"Seattle","capacity_min":150}

Input: "Show me 10 conference hotels in New York, NY with AV equipment and WiFi."
Output: {"type":"Conference","limit":10,"city":"New York","state":"NY","amenities":["AUDIOVIDEO_CAPABILITIES","HIGH_SPEED_INTERNET"]}`;

      const result = await this.prompt(prompt);
      // Clean response to extract only JSON
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No valid JSON found in response');
    } catch (error) {
      console.error('Error parsing venue request:', error);
      return { error: 'Failed to parse venue request' };
    }
  }

  async callVenueAPI(searchParams) {
    try {
      const response = await fetch('https://venue-backend-1.onrender.com/api/venues/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchParams)
      });

      if (!response.ok) {
        throw new Error(`Venue API error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error calling venue API:', error);
      return { error: 'Failed to search venues' };
    }
  }

  async processVenueRequest(venueRequest) {
    try {
      // Parse the request
      const searchParams = await this.searchVenues(venueRequest);

      if (searchParams.error) {
        return { error: searchParams.error };
      }

      // Call the venue API
      const venues = await this.callVenueAPI(searchParams);

      return {
        search_parameters: searchParams,
        venues: venues,
        status: 'success'
      };
    } catch (error) {
      console.error('Error processing venue request:', error);
      return { error: 'Failed to process venue request' };
    }
  }
}