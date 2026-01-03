// Database configuration for Neon PostgreSQL
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

// Get database connection string from environment
const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!DATABASE_URL) {
    console.error('⚠️  DATABASE_URL or NEON_DATABASE_URL environment variable is required');
    console.error('   Get your connection string from: https://console.neon.tech');
    process.exit(1);
}

// Create Neon serverless client
export const sql = neon(DATABASE_URL);

// Test connection
export const testConnection = async () => {
    try {
        const result = await sql`SELECT NOW() as current_time`;
        console.log('✅ Database connection successful:', result[0].current_time);
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
};

export default { sql, testConnection };







