#!/usr/bin/env tsx

import { sql } from '../db/connection-postgres.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function updateVenueImages() {
  console.log('🔄 Updating venue images from venues.json...\n');

  try {
    // Read venues data
    const venuesPath = join(__dirname, '../../data/venues.json');
    const venuesData = JSON.parse(readFileSync(venuesPath, 'utf-8'));

    console.log(`📊 Found ${venuesData.length} venues in JSON file`);

    let updatedCount = 0;
    let skippedCount = 0;

    // Update each venue with image data
    for (const venue of venuesData) {
      if (venue.main_image || venue.hero_image) {
        try {
          // Update venue by name (since we don't have the exact UUID mapping)
          const result = await sql`
            UPDATE venues
            SET
              main_image = ${venue.main_image || null},
              hero_image = ${venue.hero_image || null}
            WHERE name = ${venue.name}
          `;

          if (result.count > 0) {
            updatedCount++;
            console.log(`✅ Updated images for: ${venue.name}`);
          } else {
            console.log(`⚠️  No match found for: ${venue.name}`);
            skippedCount++;
          }
        } catch (error) {
          console.error(`❌ Failed to update ${venue.name}:`, error);
          skippedCount++;
        }
      } else {
        console.log(`⏭️  No images for: ${venue.name}`);
        skippedCount++;
      }
    }

    console.log('\n📊 Update Summary:');
    console.log(`   - Updated: ${updatedCount} venues`);
    console.log(`   - Skipped: ${skippedCount} venues`);

    // Verify the update
    const venuesWithImages = await sql`
      SELECT COUNT(*) as count
      FROM venues
      WHERE main_image IS NOT NULL OR hero_image IS NOT NULL
    `;

    console.log(`   - Total venues with images: ${venuesWithImages[0].count}`);

    console.log('\n🎉 Image update completed successfully!');

  } catch (error) {
    console.error('❌ Image update failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

// Run update if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  updateVenueImages();
}