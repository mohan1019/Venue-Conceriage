#!/usr/bin/env tsx

import { sql } from '../db/connection-postgres.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function addImageColumns() {
  console.log('🔄 Adding image columns to venues table...\n');

  try {
    // Read and execute the migration SQL
    const migrationSQL = readFileSync(join(__dirname, '../db/add-images-migration.sql'), 'utf-8');
    await sql.unsafe(migrationSQL);

    console.log('✅ Image columns added successfully');

    // Verify the columns were added
    const columns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'venues'
      AND column_name IN ('main_image', 'hero_image')
      ORDER BY column_name
    `;

    console.log('📊 Image columns in venues table:');
    columns.forEach((col: any) => {
      console.log(`   - ${col.column_name} ✅`);
    });

    console.log('\n🎉 Image columns migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addImageColumns();
}