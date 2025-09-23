#!/usr/bin/env tsx

import { pool } from '../db/connection.js';

async function checkDatabaseStatus() {
  console.log('🔍 Checking database status...\n');

  try {
    // Test connection
    const client = await pool.connect();
    console.log('✅ Database connection: SUCCESS');
    client.release();

    // Check if tables exist
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('\n📋 Database Tables:');
    if (tables.rows.length === 0) {
      console.log('   ❌ No tables found - Run: npm run db:migrate');
    } else {
      tables.rows.forEach(row => {
        console.log(`   ✅ ${row.table_name}`);
      });
    }

    // Check data counts
    if (tables.rows.some(row => row.table_name === 'venues')) {
      const venuesCount = await pool.query('SELECT COUNT(*) FROM venues');
      console.log(`\n📊 Data Summary:`);
      console.log(`   - Venues: ${venuesCount.rows[0].count}`);
    }

    if (tables.rows.some(row => row.table_name === 'inquiries')) {
      const inquiriesCount = await pool.query('SELECT COUNT(*) FROM inquiries');
      console.log(`   - Inquiries: ${inquiriesCount.rows[0].count}`);
    }

    console.log('\n🎉 Database status check complete!');

  } catch (error) {
    console.error('❌ Database connection failed:', error);
    console.log('\n💡 Make sure your database is running and credentials are correct.');
    console.log('   Check your .env file and Supabase connection.');
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Run if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkDatabaseStatus();
}