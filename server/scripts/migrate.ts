#!/usr/bin/env tsx

import { initializeDatabase, importVenuesData } from '../db/init.js';
import { sql } from '../db/connection-postgres.js';

async function runMigrations() {
  console.log('🔄 Starting database migration...\n');

  try {
    // Step 1: Initialize database schema
    console.log('📋 Step 1: Creating database schema...');
    const schemaCreated = await initializeDatabase();

    if (!schemaCreated) {
      throw new Error('Failed to create database schema');
    }
    console.log('✅ Database schema created successfully\n');

    // Step 2: Import venues data
    console.log('📊 Step 2: Importing venues data...');
    const dataImported = await importVenuesData();

    if (!dataImported) {
      console.warn('⚠️  Warning: Failed to import venues data');
    } else {
      console.log('✅ Venues data imported successfully\n');
    }

    // Step 3: Verify data
    console.log('🔍 Step 3: Verifying migration...');
    const venuesCount = await sql`SELECT COUNT(*) FROM venues`;
    const inquiriesCount = await sql`SELECT COUNT(*) FROM inquiries`;

    console.log(`📊 Migration Summary:`);
    console.log(`   - Venues: ${venuesCount[0].count}`);
    console.log(`   - Inquiries: ${inquiriesCount[0].count}`);
    console.log(`   - Database: Connected ✅`);

    console.log('\n🎉 Migration completed successfully!');
    console.log('💡 Your database is ready to use.\n');

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
  runMigrations();
}