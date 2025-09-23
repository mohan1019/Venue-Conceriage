import postgres from 'postgres';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is not defined in environment variables');
  console.error('💡 Please add DATABASE_URL to your .env file');
  console.error('   Example: DATABASE_URL=postgresql://postgres:password@db.project.supabase.co:5432/postgres');
  process.exit(1);
}

// Create postgres connection using Supabase recommended method
export const sql = postgres(connectionString, {
  ssl: 'require',
  max: 20,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Test the connection
export const testConnection = async (): Promise<boolean> => {
  try {
    await sql`SELECT NOW()`;
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
};

// Helper function to execute queries with proper error handling
export const query = async (queryText: string, params: any[] = []) => {
  try {
    const result = await sql.unsafe(queryText, params);
    return { rows: result };
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing database connections...');
  await sql.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Closing database connections...');
  await sql.end();
  process.exit(0);
});