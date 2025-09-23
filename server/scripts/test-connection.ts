#!/usr/bin/env tsx

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...\n');

  // Test 1: Individual connection parameters
  console.log('📋 Test 1: Using individual parameters');
  console.log(`Host: ${process.env.DB_HOST}`);
  console.log(`Port: ${process.env.DB_PORT}`);
  console.log(`Database: ${process.env.DB_NAME}`);
  console.log(`User: ${process.env.DB_USER}`);
  console.log(`Password: ${process.env.DB_PASSWORD ? '[SET]' : '[NOT SET]'}\n`);

  const pool1 = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool1.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Individual parameters: SUCCESS');
  } catch (error) {
    console.log('❌ Individual parameters: FAILED');
    console.log(`   Error: ${(error as Error).message}\n`);
  } finally {
    await pool1.end();
  }

  // Test 2: Connection string
  console.log('📋 Test 2: Using connection string');
  console.log(`URL: ${process.env.DATABASE_URL}\n`);

  if (process.env.DATABASE_URL) {
    const pool2 = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      },
      connectionTimeoutMillis: 5000,
    });

    try {
      const client = await pool2.connect();
      await client.query('SELECT NOW()');
      client.release();
      console.log('✅ Connection string: SUCCESS');
    } catch (error) {
      console.log('❌ Connection string: FAILED');
      console.log(`   Error: ${(error as Error).message}\n`);
    } finally {
      await pool2.end();
    }
  } else {
    console.log('❌ Connection string: NOT SET\n');
  }

  console.log('💡 Next steps:');
  console.log('1. Check your Supabase dashboard for correct connection details');
  console.log('2. Update your .env file with the correct values');
  console.log('3. Make sure your Supabase project is active and accessible');
  console.log('4. Try using the connection string format instead');
}

testDatabaseConnection().catch(console.error);