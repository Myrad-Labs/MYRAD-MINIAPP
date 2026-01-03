// Database initialization script
// Run this to set up the database schema

import { initializeSchema, dropSchema } from './dbSchema.js';
import { testConnection } from './dbConfig.js';

const args = process.argv.slice(2);
const shouldDrop = args.includes('--drop');

async function init() {
    console.log('🚀 Initializing database...');
    
    // Test connection first
    const connected = await testConnection();
    if (!connected) {
        console.error('❌ Cannot proceed without database connection');
        process.exit(1);
    }
    
    if (shouldDrop) {
        console.log('⚠️  Dropping existing schema...');
        await dropSchema();
    }
    
    // Initialize schema
    await initializeSchema();
    
    console.log('✅ Database initialization complete!');
    process.exit(0);
}

init().catch(error => {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
});







