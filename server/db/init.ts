import { sql, testConnection } from './connection-postgres.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize database schema
export const initializeDatabase = async (): Promise<boolean> => {
  try {
    console.log('🔄 Initializing database...');

    // Test connection first
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Failed to connect to database');
    }

    // Read and execute schema
    const schemaSQL = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    await sql.unsafe(schemaSQL);

    console.log('✅ Database schema initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    return false;
  }
};

// Import venues data from JSON file
export const importVenuesData = async (): Promise<boolean> => {
  try {
    console.log('🔄 Importing venues data...');

    // Read venues data
    const venuesPath = join(__dirname, '../../data/venues.json');
    const venuesData = JSON.parse(readFileSync(venuesPath, 'utf-8'));

    // Check if venues already exist
    const existingVenues = await sql`SELECT COUNT(*) FROM venues`;
    const count = parseInt(existingVenues[0].count);

    if (count > 0) {
      console.log(`📊 Found ${count} existing venues in database`);
      return true;
    }

    // Insert venues data
    for (const venue of venuesData) {
      const insertQuery = `
        INSERT INTO venues (
          name, city, state, country, metro_area, capacity, type,
          amenities, tags, diamond_level, preferred_rating,
          lat, lon, airport_distance_mi, meeting_rooms_total,
          total_meeting_area_sqft, largest_space_sqft,
          price_per_hour, hourly_rate, main_image, hero_image, promotions,
          contact_email, contact_phone, manager_name, description
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
        )
      `;

      const values = [
        venue.name || null,
        venue.city || null,
        venue.state || null,
        venue.country || null,
        venue.metro_area || null,
        venue.capacity ? parseInt(venue.capacity) : null,
        venue.type || null,
        venue.amenities ? venue.amenities.split(', ').map((a: string) => a.trim()) : [],
        venue.tags ? venue.tags.split(', ').map((t: string) => t.trim()) : [],
        venue.diamond_level || null,
        venue.preferred_rating || null,
        venue.lat ? parseFloat(venue.lat) : null,
        venue.lon ? parseFloat(venue.lon) : null,
        venue.airport_distance_mi ? parseFloat(venue.airport_distance_mi) : null,
        venue.meeting_rooms_total ? parseInt(venue.meeting_rooms_total) : null,
        venue.total_meeting_area_sqft ? parseInt(venue.total_meeting_area_sqft) : null,
        venue.largest_space_sqft ? parseInt(venue.largest_space_sqft) : null,
        venue.price_per_hour ? parseFloat(venue.price_per_hour) : null,
        venue.hourly_rate ? parseFloat(venue.hourly_rate) : null,
        venue.main_image || null,
        venue.hero_image || null,
        venue.promotions ? JSON.stringify(venue.promotions) : null,
        venue.contact_email || null,
        venue.contact_phone || null,
        venue.manager_name || null,
        venue.description || null
      ];

      await sql.unsafe(insertQuery, values);
    }

    console.log(`✅ Imported ${venuesData.length} venues to database`);
    return true;
  } catch (error) {
    console.error('❌ Failed to import venues data:', error);
    return false;
  }
};

// Clean up expired cache entries
export const cleanupCache = async (): Promise<void> => {
  try {
    await sql`SELECT cleanup_expired_cache()`;
    console.log('🧹 Cache cleanup completed');
  } catch (error) {
    console.error('❌ Cache cleanup failed:', error);
  }
};