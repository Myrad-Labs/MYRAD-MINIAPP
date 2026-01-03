// Database schema creation for Neon PostgreSQL
// Uses existing tables: github_contributions, zomato_contributions, netflix_contributions

import { sql } from './dbConfig.js';

/**
 * Initialize database schema - creates the existing contribution tables
 */
export const initializeSchema = async () => {
    console.log('📊 Initializing database schema...');

    try {
        // Create zomato_contributions table
        await sql`
            CREATE TABLE IF NOT EXISTS zomato_contributions (
                id VARCHAR(255) PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                wallet_address VARCHAR(255),
                data JSONB NOT NULL,
                sellable_data JSONB,
                behavioral_insights JSONB,
                reclaim_proof_id VARCHAR(255),
                processing_method VARCHAR(100) DEFAULT 'raw',
                status VARCHAR(50) DEFAULT 'verified',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `;

        // Create netflix_contributions table
        await sql`
            CREATE TABLE IF NOT EXISTS netflix_contributions (
                id VARCHAR(255) PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                wallet_address VARCHAR(255),
                data JSONB NOT NULL,
                sellable_data JSONB,
                behavioral_insights JSONB,
                reclaim_proof_id VARCHAR(255),
                processing_method VARCHAR(100) DEFAULT 'raw',
                status VARCHAR(50) DEFAULT 'verified',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `;

        // Create github_contributions table
        await sql`
            CREATE TABLE IF NOT EXISTS github_contributions (
                id VARCHAR(255) PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                wallet_address VARCHAR(255),
                data JSONB NOT NULL,
                sellable_data JSONB,
                behavioral_insights JSONB,
                reclaim_proof_id VARCHAR(255),
                processing_method VARCHAR(100) DEFAULT 'raw',
                status VARCHAR(50) DEFAULT 'verified',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `;

        // Create indexes for better query performance
        await sql`CREATE INDEX IF NOT EXISTS idx_zomato_contributions_user_id ON zomato_contributions(user_id)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_zomato_contributions_created_at ON zomato_contributions(created_at)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_zomato_contributions_sellable_data ON zomato_contributions USING GIN(sellable_data)`;

        await sql`CREATE INDEX IF NOT EXISTS idx_netflix_contributions_user_id ON netflix_contributions(user_id)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_netflix_contributions_created_at ON netflix_contributions(created_at)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_netflix_contributions_sellable_data ON netflix_contributions USING GIN(sellable_data)`;

        await sql`CREATE INDEX IF NOT EXISTS idx_github_contributions_user_id ON github_contributions(user_id)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_github_contributions_created_at ON github_contributions(created_at)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_github_contributions_sellable_data ON github_contributions USING GIN(sellable_data)`;

        // Create index on cohort_id within sellable_data for k-anonymity queries (only if sellable_data column exists)
        try {
            await sql`CREATE INDEX IF NOT EXISTS idx_zomato_contributions_cohort_id ON zomato_contributions((sellable_data->'audience_segment'->>'segment_id'))`;
            await sql`CREATE INDEX IF NOT EXISTS idx_netflix_contributions_cohort_id ON netflix_contributions((sellable_data->'audience_segment'->>'segment_id'))`;
            await sql`CREATE INDEX IF NOT EXISTS idx_github_contributions_cohort_id ON github_contributions((sellable_data->'audience_segment'->>'segment_id'))`;
        } catch (error) {
            // Index creation might fail if column doesn't exist, that's okay
            console.log('⚠️  Some indexes could not be created (columns may not exist yet)');
        }

        console.log('✅ Database schema initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Error initializing database schema:', error);
        throw error;
    }
};



/**
 * Drop all tables (use with caution - for development only)
 */
export const dropSchema = async () => {
    console.log('⚠️  Dropping database schema...');
    try {
        await sql`DROP TABLE IF EXISTS zomato_contributions CASCADE`;
        await sql`DROP TABLE IF EXISTS netflix_contributions CASCADE`;
        await sql`DROP TABLE IF EXISTS github_contributions CASCADE`;
        console.log('✅ Database schema dropped');
        return true;
    } catch (error) {
        console.error('❌ Error dropping schema:', error);
        throw error;
    }
};







