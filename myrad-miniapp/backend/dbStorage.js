// Database storage for contributions - replaces JSON file storage
// Uses Neon PostgreSQL with existing tables: github_contributions, zomato_contributions, netflix_contributions

import { sql } from './dbConfig.js';
import { getTableColumns } from './dbHelpers.js';

// Map dataType to table name
const getTableName = (dataType) => {
    if (dataType === 'zomato_order_history') return 'zomato_contributions';
    if (dataType === 'netflix_watch_history') return 'netflix_contributions';
    if (dataType === 'github_profile') return 'github_contributions';
    throw new Error(`Unknown dataType: ${dataType}`);
};

/**
 * Get all contributions for a specific data type
 */
export const getContributions = async (dataType = null) => {
    try {
        if (dataType) {
            const tableName = getTableName(dataType);
            // Use conditional queries for each table
            let result;
            // Use SELECT * to get whatever columns exist
            if (tableName === 'zomato_contributions') {
                result = await sql`SELECT * FROM zomato_contributions ORDER BY created_at DESC`;
            } else if (tableName === 'netflix_contributions') {
                result = await sql`SELECT * FROM netflix_contributions ORDER BY created_at DESC`;
            } else if (tableName === 'github_contributions') {
                result = await sql`SELECT * FROM github_contributions ORDER BY created_at DESC`;
            }
            
            // Map column names to camelCase for consistency
            result = result.map(row => ({
                id: row.id,
                userId: row.user_id || row.userId,
                walletAddress: row.wallet_address || row.walletAddress,
                data: row.data,
                sellableData: row.sellable_data || row.sellableData,
                behavioralInsights: row.behavioral_insights || row.behavioralInsights,
                reclaimProofId: row.reclaim_proof_id || row.reclaimProofId,
                processingMethod: row.processing_method || row.processingMethod,
                status: row.status,
                createdAt: row.created_at || row.createdAt,
                ...row // Include any other columns that exist
            }));
            // Add dataType to each result
            return result.map(c => ({ ...c, dataType }));
        } else {
            // Return all contributions from all providers using SELECT *
            const [zomato, netflix, github] = await Promise.all([
                sql`SELECT * FROM zomato_contributions ORDER BY created_at DESC`,
                sql`SELECT * FROM netflix_contributions ORDER BY created_at DESC`,
                sql`SELECT * FROM github_contributions ORDER BY created_at DESC`
            ]);
            
            // Map column names and add dataType
            const mapRow = (row, dataType) => ({
                id: row.id,
                userId: row.user_id || row.userId,
                walletAddress: row.wallet_address || row.walletAddress,
                data: row.data,
                sellableData: row.sellable_data || row.sellableData,
                behavioralInsights: row.behavioral_insights || row.behavioralInsights,
                reclaimProofId: row.reclaim_proof_id || row.reclaimProofId,
                processingMethod: row.processing_method || row.processingMethod,
                status: row.status,
                createdAt: row.created_at || row.createdAt,
                dataType,
                ...row
            });
            
            const allContributions = [
                ...zomato.map(c => mapRow(c, 'zomato_order_history')),
                ...netflix.map(c => mapRow(c, 'netflix_watch_history')),
                ...github.map(c => mapRow(c, 'github_profile'))
            ];
            
            return allContributions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
    } catch (error) {
        console.error('Error getting contributions:', error);
        return [];
    }
};

/**
 * Save contributions (for backward compatibility - not used with database)
 */
export const saveContributions = async (contributions, dataType = null) => {
    // This function is kept for backward compatibility but doesn't do anything
    // since we're using database inserts directly
    console.warn('saveContributions called but not needed with database storage');
    return true;
};

/**
 * Get contributions by user ID
 */
export const getUserContributions = async (userId) => {
    try {
        const [zomato, netflix, github] = await Promise.all([
            sql`SELECT * FROM zomato_contributions WHERE user_id = ${userId} ORDER BY created_at DESC`,
            sql`SELECT * FROM netflix_contributions WHERE user_id = ${userId} ORDER BY created_at DESC`,
            sql`SELECT * FROM github_contributions WHERE user_id = ${userId} ORDER BY created_at DESC`
        ]);
        
        const mapRow = (row, dataType) => ({
            id: row.id,
            userId: row.user_id || row.userId,
            walletAddress: row.wallet_address || row.walletAddress,
            data: row.data,
            sellableData: row.sellable_data || row.sellableData,
            behavioralInsights: row.behavioral_insights || row.behavioralInsights,
            reclaimProofId: row.reclaim_proof_id || row.reclaimProofId,
            processingMethod: row.processing_method || row.processingMethod,
            status: row.status,
            createdAt: row.created_at || row.createdAt,
            dataType,
            ...row
        });
        
        const allContributions = [
            ...zomato.map(c => mapRow(c, 'zomato_order_history')),
            ...netflix.map(c => mapRow(c, 'netflix_watch_history')),
            ...github.map(c => mapRow(c, 'github_profile'))
        ];
        
        return allContributions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (error) {
        console.error('Error getting user contributions:', error);
        return [];
    }
};

// Alias for compatibility
export const getContributionsByUserId = getUserContributions;

/**
 * Get cohort size for k-anonymity compliance
 */
export const getCohortSize = async (cohortId) => {
    try {
        const [zomato, netflix, github] = await Promise.all([
            sql`SELECT COUNT(*) as count FROM zomato_contributions WHERE sellable_data->'audience_segment'->>'segment_id' = ${cohortId}`,
            sql`SELECT COUNT(*) as count FROM netflix_contributions WHERE sellable_data->'audience_segment'->>'segment_id' = ${cohortId}`,
            sql`SELECT COUNT(*) as count FROM github_contributions WHERE sellable_data->'audience_segment'->>'segment_id' = ${cohortId}`
        ]);
        
        const total = parseInt(zomato[0]?.count || 0, 10) + 
                     parseInt(netflix[0]?.count || 0, 10) + 
                     parseInt(github[0]?.count || 0, 10);
        
        return total;
    } catch (error) {
        console.error('Error getting cohort size:', error);
        return 0;
    }
};

/**
 * Get all unique cohorts with their sizes
 */
export const getCohortSizes = async () => {
    try {
        // Get cohort IDs from all tables
        const [zomato, netflix, github] = await Promise.all([
            sql`SELECT sellable_data->'audience_segment'->>'segment_id' as cohort_id, COUNT(*) as count FROM zomato_contributions WHERE sellable_data->'audience_segment'->>'segment_id' IS NOT NULL GROUP BY cohort_id`,
            sql`SELECT sellable_data->'audience_segment'->>'segment_id' as cohort_id, COUNT(*) as count FROM netflix_contributions WHERE sellable_data->'audience_segment'->>'segment_id' IS NOT NULL GROUP BY cohort_id`,
            sql`SELECT sellable_data->'audience_segment'->>'segment_id' as cohort_id, COUNT(*) as count FROM github_contributions WHERE sellable_data->'audience_segment'->>'segment_id' IS NOT NULL GROUP BY cohort_id`
        ]);
        
        // Combine and sum counts for same cohort IDs
        const cohortCounts = {};
        
        [...zomato, ...netflix, ...github].forEach(row => {
            const cohortId = row.cohort_id;
            if (cohortId) {
                cohortCounts[cohortId] = (cohortCounts[cohortId] || 0) + parseInt(row.count || 0, 10);
            }
        });
        
        return cohortCounts;
    } catch (error) {
        console.error('Error getting cohort sizes:', error);
        return {};
    }
};

/**
 * Add a new contribution to the database
 * Uses only columns that actually exist in the table
 */
export const addContribution = async (userId, data) => {
    try {
        const dataType = data.dataType || 'general';
        const tableName = getTableName(dataType);
        
        const contributionId = Date.now().toString();
        const createdAt = new Date().toISOString();
        
        // Get actual columns that exist in the table
        const existingColumns = await getTableColumns(tableName);
        
        // Build column-value pairs only for existing columns
        const columnValues = {};
        const columnList = [];
        const valueList = [];
        let paramIndex = 1;
        
        if (existingColumns.includes('id')) {
            columnList.push('id');
            valueList.push(contributionId);
        }
        if (existingColumns.includes('user_id')) {
            columnList.push('user_id');
            valueList.push(userId);
        }
        if (existingColumns.includes('wallet_address')) {
            columnList.push('wallet_address');
            valueList.push(data.walletAddress || null);
        }
        if (existingColumns.includes('data')) {
            columnList.push('data');
            valueList.push(JSON.stringify(data.anonymizedData));
        }
        if (existingColumns.includes('sellable_data')) {
            columnList.push('sellable_data');
            // If sellable_data has NOT NULL constraint, provide empty object instead of null
            valueList.push(data.sellableData ? JSON.stringify(data.sellableData) : JSON.stringify({}));
        }
        if (existingColumns.includes('behavioral_insights')) {
            columnList.push('behavioral_insights');
            valueList.push(data.behavioralInsights ? JSON.stringify(data.behavioralInsights) : null);
        }
        if (existingColumns.includes('reclaim_proof_id')) {
            columnList.push('reclaim_proof_id');
            valueList.push(data.reclaimProofId || null);
        }
        if (existingColumns.includes('processing_method')) {
            columnList.push('processing_method');
            valueList.push(data.processingMethod || 'raw');
        }
        if (existingColumns.includes('status')) {
            columnList.push('status');
            valueList.push('verified');
        }
        if (existingColumns.includes('created_at')) {
            columnList.push('created_at');
            valueList.push(createdAt);
        }
        if (existingColumns.includes('updated_at')) {
            columnList.push('updated_at');
            valueList.push(createdAt);
        }
        
        // Extract values from sellable_data to populate individual columns (for GitHub)
        if (tableName === 'github_contributions' && data.sellableData) {
            const sd = data.sellableData;
            
            // Extract follower_count
            if (existingColumns.includes('follower_count')) {
                const followers = data.anonymizedData?.followers || 
                                parseInt(data.anonymizedData?.followers || '0', 10);
                columnList.push('follower_count');
                valueList.push(followers);
            }
            
            // Extract contribution_count
            if (existingColumns.includes('contribution_count')) {
                const contributions = sd?.activity_metrics?.yearly_contributions || 
                                    parseInt(data.anonymizedData?.contributionsLastYear || '0', 10);
                columnList.push('contribution_count');
                valueList.push(contributions);
            }
            
            // Extract developer_tier
            if (existingColumns.includes('developer_tier')) {
                columnList.push('developer_tier');
                valueList.push(sd?.developer_profile?.tier || null);
            }
            
            // Extract follower_tier
            if (existingColumns.includes('follower_tier')) {
                columnList.push('follower_tier');
                valueList.push(sd?.social_metrics?.follower_tier || null);
            }
            
            // Extract activity_level
            if (existingColumns.includes('activity_level')) {
                columnList.push('activity_level');
                valueList.push(sd?.activity_metrics?.activity_level || null);
            }
            
            // Extract is_influencer
            if (existingColumns.includes('is_influencer')) {
                columnList.push('is_influencer');
                valueList.push(sd?.social_metrics?.is_influencer || false);
            }
            
            // Extract is_active_contributor
            if (existingColumns.includes('is_active_contributor')) {
                columnList.push('is_active_contributor');
                valueList.push(sd?.activity_metrics?.is_active_contributor || false);
            }
            
            // Extract data_quality_score
            if (existingColumns.includes('data_quality_score')) {
                columnList.push('data_quality_score');
                valueList.push(sd?.metadata?.data_quality?.score || null);
            }
            
            // Extract cohort_id
            if (existingColumns.includes('cohort_id')) {
                columnList.push('cohort_id');
                valueList.push(sd?.audience_segment?.segment_id || null);
            }
            
            // Extract metadata (if it's a separate column)
            if (existingColumns.includes('metadata')) {
                columnList.push('metadata');
                valueList.push(sd?.metadata ? JSON.stringify(sd.metadata) : null);
            }
        }
        
        // Extract values from sellable_data to populate individual columns (for Netflix)
        if (tableName === 'netflix_contributions' && data.sellableData) {
            const sd = data.sellableData;
            
            // Extract total_titles_watched
            if (existingColumns.includes('total_titles_watched')) {
                columnList.push('total_titles_watched');
                valueList.push(sd?.viewing_summary?.total_titles_watched || 
                             sd?.user_profile?.total_titles_watched || null);
            }
            
            // Extract total_watch_hours
            if (existingColumns.includes('total_watch_hours')) {
                columnList.push('total_watch_hours');
                valueList.push(sd?.viewing_summary?.total_watch_hours || null);
            }
            
            // Extract binge_score
            if (existingColumns.includes('binge_score')) {
                columnList.push('binge_score');
                valueList.push(sd?.viewing_behavior?.binge_score || null);
            }
            
            // Extract engagement_tier
            if (existingColumns.includes('engagement_tier')) {
                columnList.push('engagement_tier');
                valueList.push(sd?.viewing_summary?.engagement_tier || null);
            }
            
            // Extract top_genres (JSON array)
            if (existingColumns.includes('top_genres')) {
                columnList.push('top_genres');
                valueList.push(sd?.content_preferences?.top_genres ? 
                             JSON.stringify(sd.content_preferences.top_genres) : null);
            }
            
            // Extract genre_diversity_score
            if (existingColumns.includes('genre_diversity_score')) {
                columnList.push('genre_diversity_score');
                valueList.push(sd?.content_preferences?.genre_diversity_score || null);
            }
            
            // Extract dominant_content_type
            if (existingColumns.includes('dominant_content_type')) {
                columnList.push('dominant_content_type');
                valueList.push(sd?.content_preferences?.content_type_preference || 
                             sd?.content_catalog?.content_type_breakdown?.dominant_type || null);
            }
            
            // Extract primary_language (if available)
            if (existingColumns.includes('primary_language')) {
                columnList.push('primary_language');
                valueList.push(null); // Not in sellable_data structure
            }
            
            // Extract peak_viewing_day
            if (existingColumns.includes('peak_viewing_day')) {
                columnList.push('peak_viewing_day');
                valueList.push(sd?.viewing_behavior?.peak_viewing_day || null);
            }
            
            // Extract peak_viewing_time
            if (existingColumns.includes('peak_viewing_time')) {
                columnList.push('peak_viewing_time');
                valueList.push(sd?.viewing_behavior?.peak_viewing_time || null);
            }
            
            // Extract late_night_viewer
            if (existingColumns.includes('late_night_viewer')) {
                columnList.push('late_night_viewer');
                valueList.push(sd?.viewing_behavior?.late_night_viewer || false);
            }
            
            // Extract is_binge_watcher
            if (existingColumns.includes('is_binge_watcher')) {
                columnList.push('is_binge_watcher');
                valueList.push(sd?.viewing_behavior?.is_binge_watcher || false);
            }
            
            // Extract day_of_week_distribution (JSON object)
            if (existingColumns.includes('day_of_week_distribution')) {
                columnList.push('day_of_week_distribution');
                valueList.push(sd?.viewing_behavior?.day_of_week_distribution ? 
                             JSON.stringify(sd.viewing_behavior.day_of_week_distribution) : null);
            }
            
            // Extract time_of_day_curve (JSON object)
            if (existingColumns.includes('time_of_day_curve')) {
                columnList.push('time_of_day_curve');
                valueList.push(sd?.viewing_behavior?.time_of_day_curve ? 
                             JSON.stringify(sd.viewing_behavior.time_of_day_curve) : null);
            }
            
            // Extract subscription_tier
            if (existingColumns.includes('subscription_tier')) {
                columnList.push('subscription_tier');
                valueList.push(sd?.subscription_data?.tier || null);
            }
            
            // Extract account_age_years (if available)
            if (existingColumns.includes('account_age_years')) {
                columnList.push('account_age_years');
                valueList.push(null); // Not in sellable_data structure
            }
            
            // Extract member_since_year (if available)
            if (existingColumns.includes('member_since_year')) {
                columnList.push('member_since_year');
                valueList.push(null); // Not in sellable_data structure
            }
            
            // Extract loyalty_tier
            if (existingColumns.includes('loyalty_tier')) {
                columnList.push('loyalty_tier');
                valueList.push(sd?.subscription_data?.loyalty_tier || null);
            }
            
            // Extract churn_risk
            if (existingColumns.includes('churn_risk')) {
                columnList.push('churn_risk');
                valueList.push(sd?.subscription_data?.churn_risk || null);
            }
            
            // Extract kids_content_pct (if available)
            if (existingColumns.includes('kids_content_pct')) {
                columnList.push('kids_content_pct');
                valueList.push(null); // Would need to calculate from genre data
            }
            
            // Extract mature_content_pct (if available)
            if (existingColumns.includes('mature_content_pct')) {
                columnList.push('mature_content_pct');
                valueList.push(null); // Would need to calculate from genre data
            }
            
            // Extract primary_audience (if available)
            if (existingColumns.includes('primary_audience')) {
                columnList.push('primary_audience');
                valueList.push(null); // Not in sellable_data structure
            }
            
            // Extract segment_id
            if (existingColumns.includes('segment_id')) {
                columnList.push('segment_id');
                valueList.push(sd?.audience_segment?.segment_id || null);
            }
            
            // Extract cohort_id
            if (existingColumns.includes('cohort_id')) {
                columnList.push('cohort_id');
                valueList.push(sd?.audience_segment?.segment_id || 
                             sd?.metadata?.privacy_compliance?.cohort_id || null);
            }
            
            // Extract data_quality_score
            if (existingColumns.includes('data_quality_score')) {
                columnList.push('data_quality_score');
                valueList.push(sd?.metadata?.data_quality?.score || null);
            }
            
            // Extract movies_watched (JSON array)
            if (existingColumns.includes('movies_watched')) {
                columnList.push('movies_watched');
                valueList.push(sd?.content_catalog?.movies_watched ? 
                             JSON.stringify(sd.content_catalog.movies_watched) : null);
            }
            
            // Extract top_series (JSON array)
            if (existingColumns.includes('top_series')) {
                columnList.push('top_series');
                valueList.push(sd?.content_catalog?.top_series ? 
                             JSON.stringify(sd.content_catalog.top_series) : null);
            }
            
            // Extract metadata (if it's a separate column)
            if (existingColumns.includes('metadata')) {
                columnList.push('metadata');
                valueList.push(sd?.metadata ? JSON.stringify(sd.metadata) : null);
            }
        }
        
        // Extract values from sellable_data to populate individual columns (for Zomato)
        if (tableName === 'zomato_contributions' && data.sellableData) {
            const sd = data.sellableData;
            
            // Extract total_orders
            if (existingColumns.includes('total_orders')) {
                columnList.push('total_orders');
                valueList.push(sd?.transaction_data?.summary?.total_orders || null);
            }
            
            // Extract total_gmv
            if (existingColumns.includes('total_gmv')) {
                columnList.push('total_gmv');
                valueList.push(sd?.transaction_data?.summary?.total_gmv || null);
            }
            
            // Extract avg_order_value
            if (existingColumns.includes('avg_order_value')) {
                columnList.push('avg_order_value');
                valueList.push(sd?.transaction_data?.summary?.avg_order_value || null);
            }
            
            // Extract frequency_tier
            if (existingColumns.includes('frequency_tier')) {
                columnList.push('frequency_tier');
                valueList.push(sd?.transaction_data?.frequency_metrics?.frequency_tier || null);
            }
            
            // Extract lifestyle_segment
            if (existingColumns.includes('lifestyle_segment')) {
                columnList.push('lifestyle_segment');
                valueList.push(sd?.audience_segment?.dmp_attributes?.lifestyle_segment || 
                             sd?.consumer_profile?.spend_tier || null);
            }
            
            // Extract city_cluster
            if (existingColumns.includes('city_cluster')) {
                columnList.push('city_cluster');
                valueList.push(sd?.geo_data?.city_cluster || null);
            }
            
            // Extract data_quality_score
            if (existingColumns.includes('data_quality_score')) {
                columnList.push('data_quality_score');
                valueList.push(sd?.metadata?.data_quality?.score || null);
            }
            
            // Extract cohort_id
            if (existingColumns.includes('cohort_id')) {
                columnList.push('cohort_id');
                valueList.push(sd?.audience_segment?.segment_id || 
                             sd?.metadata?.privacy_compliance?.cohort_id || null);
            }
            
            // Extract top_cuisines (JSON array)
            if (existingColumns.includes('top_cuisines')) {
                columnList.push('top_cuisines');
                valueList.push(sd?.audience_segment?.dmp_attributes?.interest_cuisine_types ? 
                             JSON.stringify(sd.audience_segment.dmp_attributes.interest_cuisine_types) : null);
            }
            
            // Extract top_brands (JSON array)
            if (existingColumns.includes('top_brands')) {
                columnList.push('top_brands');
                valueList.push(sd?.brand_intelligence?.top_brands ? 
                             JSON.stringify(sd.brand_intelligence.top_brands) : null);
            }
            
            // Extract segment_id
            if (existingColumns.includes('segment_id')) {
                columnList.push('segment_id');
                valueList.push(sd?.audience_segment?.segment_id || null);
            }
            
            // Extract chain_vs_local_preference
            if (existingColumns.includes('chain_vs_local_preference')) {
                columnList.push('chain_vs_local_preference');
                valueList.push(sd?.brand_intelligence?.chain_vs_local_preference || null);
            }
            
            // Extract day_of_week_distribution (JSON object)
            if (existingColumns.includes('day_of_week_distribution')) {
                columnList.push('day_of_week_distribution');
                valueList.push(sd?.temporal_behavior?.day_of_week_distribution ? 
                             JSON.stringify(sd.temporal_behavior.day_of_week_distribution) : null);
            }
            
            // Extract time_of_day_curve (JSON object)
            if (existingColumns.includes('time_of_day_curve')) {
                columnList.push('time_of_day_curve');
                valueList.push(sd?.temporal_behavior?.time_of_day_curve ? 
                             JSON.stringify(sd.temporal_behavior.time_of_day_curve) : null);
            }
            
            // Extract peak_ordering_day
            if (existingColumns.includes('peak_ordering_day')) {
                columnList.push('peak_ordering_day');
                valueList.push(sd?.temporal_behavior?.peak_ordering_day || 
                             sd?.consumer_profile?.timing_preferences?.peak_order_day || null);
            }
            
            // Extract peak_ordering_time
            if (existingColumns.includes('peak_ordering_time')) {
                columnList.push('peak_ordering_time');
                valueList.push(sd?.temporal_behavior?.peak_ordering_time || 
                             sd?.consumer_profile?.timing_preferences?.peak_order_time || null);
            }
            
            // Extract late_night_eater
            if (existingColumns.includes('late_night_eater')) {
                columnList.push('late_night_eater');
                valueList.push(sd?.temporal_behavior?.late_night_eater || 
                             sd?.behavioral_traits?.late_night_eater || false);
            }
            
            // Extract price_bucket_distribution (JSON object)
            if (existingColumns.includes('price_bucket_distribution')) {
                columnList.push('price_bucket_distribution');
                valueList.push(sd?.price_sensitivity?.price_bucket_distribution ? 
                             JSON.stringify(sd.price_sensitivity.price_bucket_distribution) : null);
            }
            
            // Extract dominant_price_segment
            if (existingColumns.includes('dominant_price_segment')) {
                columnList.push('dominant_price_segment');
                valueList.push(sd?.price_sensitivity?.dominant_price_segment || null);
            }
            
            // Extract discount_usage_rate
            if (existingColumns.includes('discount_usage_rate')) {
                columnList.push('discount_usage_rate');
                valueList.push(sd?.price_sensitivity?.discount_usage_rate || null);
            }
            
            // Extract offer_dependent
            if (existingColumns.includes('offer_dependent')) {
                columnList.push('offer_dependent');
                valueList.push(sd?.price_sensitivity?.offer_dependent || false);
            }
            
            // Extract premium_vs_budget_ratio
            if (existingColumns.includes('premium_vs_budget_ratio')) {
                columnList.push('premium_vs_budget_ratio');
                valueList.push(sd?.price_sensitivity?.premium_vs_budget_ratio || null);
            }
            
            // Extract frequent_dishes (JSON array)
            if (existingColumns.includes('frequent_dishes')) {
                columnList.push('frequent_dishes');
                valueList.push(sd?.repeat_patterns?.frequent_dishes ? 
                             JSON.stringify(sd.repeat_patterns.frequent_dishes) : null);
            }
            
            // Extract favorite_restaurants (JSON array)
            if (existingColumns.includes('favorite_restaurants')) {
                columnList.push('favorite_restaurants');
                valueList.push(sd?.repeat_patterns?.favorite_restaurants ? 
                             JSON.stringify(sd.repeat_patterns.favorite_restaurants) : null);
            }
            
            // Extract competitor_mapping (JSON object)
            if (existingColumns.includes('competitor_mapping')) {
                columnList.push('competitor_mapping');
                valueList.push(sd?.competitor_mapping ? 
                             JSON.stringify(sd.competitor_mapping) : null);
            }
            
            // Extract repeat_baskets (JSON array)
            if (existingColumns.includes('repeat_baskets')) {
                columnList.push('repeat_baskets');
                valueList.push(sd?.basket_intelligence?.repeat_baskets ? 
                             JSON.stringify(sd.basket_intelligence.repeat_baskets) : null);
            }
            
            // Extract geo_data (JSON object)
            if (existingColumns.includes('geo_data')) {
                columnList.push('geo_data');
                valueList.push(sd?.geo_data ? 
                             JSON.stringify(sd.geo_data) : null);
            }
            
            // Extract metadata (if it's a separate column)
            if (existingColumns.includes('metadata')) {
                columnList.push('metadata');
                valueList.push(sd?.metadata ? JSON.stringify(sd.metadata) : null);
            }
        }
        
        // Build INSERT query using template literals (Neon requires tagged templates)
        // Get actual values for required columns
        const getId = () => valueList[columnList.indexOf('id')];
        const getUserId = () => valueList[columnList.indexOf('user_id')];
        const getData = () => {
            const idx = columnList.indexOf('data');
            if (idx >= 0 && valueList[idx]) {
                const val = valueList[idx];
                return typeof val === 'string' ? JSON.parse(val) : val;
            }
            return null;
        };
        const getSellableData = () => {
            const idx = columnList.indexOf('sellable_data');
            if (idx >= 0 && valueList[idx]) {
                const val = valueList[idx];
                return typeof val === 'string' ? JSON.parse(val) : val;
            }
            // If sellable_data column exists but is NULL, provide empty object to satisfy NOT NULL constraint
            if (columnList.includes('sellable_data')) {
                return {};
            }
            return null;
        };
        
        // Build dynamic INSERT with ALL columns
        // Process values for JSONB columns
        const processValue = (col, val) => {
            // JSONB columns that need parsing
            const jsonbColumns = [
                'data', 'sellable_data', 'behavioral_insights', 'metadata',
                'top_genres', 'day_of_week_distribution', 'time_of_day_curve',
                'movies_watched', 'top_series',
                'top_cuisines', 'top_brands', 'price_bucket_distribution',
                'frequent_dishes', 'favorite_restaurants', 'competitor_mapping',
                'repeat_baskets', 'geo_data'
            ];
            
            if (jsonbColumns.includes(col)) {
                if (val) {
                    return typeof val === 'string' ? JSON.parse(val) : val;
                }
                if (col === 'sellable_data') return {}; // NOT NULL constraint
                return null;
            }
            return val;
        };
        
        // For GitHub, build comprehensive INSERT with all columns
        if (tableName === 'github_contributions') {
            // Build the INSERT dynamically - we'll construct it piece by piece
            const getValue = (colName) => {
                const idx = columnList.indexOf(colName);
                return idx >= 0 ? processValue(colName, valueList[idx]) : null;
            };
            
            // Start building the query - use a more comprehensive approach
            // Since Neon requires template literals, we'll build it with all possible columns
            const idVal = getValue('id');
            const userIdVal = getValue('user_id');
            const walletAddrVal = getValue('wallet_address');
            const reclaimProofIdVal = getValue('reclaim_proof_id');
            const statusVal = getValue('status') || 'verified';
            const processingMethodVal = getValue('processing_method') || 'raw';
            const createdAtVal = getValue('created_at');
            const updatedAtVal = getValue('updated_at');
            const dataVal = getValue('data');
            const sellableDataVal = getValue('sellable_data') || {};
            const metadataVal = getValue('metadata');
            const followerCountVal = getValue('follower_count');
            const contributionCountVal = getValue('contribution_count');
            const developerTierVal = getValue('developer_tier');
            const followerTierVal = getValue('follower_tier');
            const activityLevelVal = getValue('activity_level');
            const isInfluencerVal = getValue('is_influencer');
            const isActiveContributorVal = getValue('is_active_contributor');
            const dataQualityScoreVal = getValue('data_quality_score');
            const cohortIdVal = getValue('cohort_id');
            const behavioralInsightsVal = getValue('behavioral_insights');
            
            // Build comprehensive INSERT with ALL columns from columnList
            // Process values and build the query using template literals
            // We'll construct it by building the column and value lists
            
            const getVal = (colName) => {
                const idx = columnList.indexOf(colName);
                return idx >= 0 ? processValue(colName, valueList[idx]) : null;
            };
            
            // Build the INSERT statement with all columns in order
            // Use eval or Function constructor to build dynamic template literal
            // Actually, let's use a simpler approach - build it column by column
            
            // For GitHub, we know the column structure, so build it explicitly
            const insertParts = [];
            const valueParts = [];
            
            // Add each column in order
            for (let i = 0; i < columnList.length; i++) {
                const col = columnList[i];
                const val = processValue(col, valueList[i]);
                insertParts.push(col);
                
                if (col === 'data' || col === 'sellable_data' || col === 'behavioral_insights' || col === 'metadata') {
                    valueParts.push(sql`${val}::jsonb`);
                } else {
                    valueParts.push(sql`${val}`);
                }
            }
            
            // Build the query - we need to use a different approach since template literals can't be fully dynamic
            // Let's use the pg library directly for this dynamic insert
            const { Pool } = await import('pg');
            const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL });
            
            const colsStr = insertParts.join(', ');
            const placeholders = insertParts.map((_, i) => {
                const col = insertParts[i];
                if (col === 'data' || col === 'sellable_data' || col === 'behavioral_insights' || col === 'metadata') {
                    return `$${i + 1}::jsonb`;
                }
                return `$${i + 1}`;
            }).join(', ');
            
            const query = `INSERT INTO github_contributions (${colsStr}) VALUES (${placeholders})`;
            const processedValues = insertParts.map((col, idx) => {
                const val = processValue(col, valueList[columnList.indexOf(col)]);
                return val;
            });
            
            await pool.query(query, processedValues);
            await pool.end();
        } else if (tableName === 'zomato_contributions') {
            // Build comprehensive INSERT with ALL columns for Zomato (same approach as GitHub and Netflix)
            const { Pool } = await import('pg');
            const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL });
            
            const colsStr = columnList.join(', ');
            const placeholders = columnList.map((_, i) => {
                const col = columnList[i];
                // JSONB columns: data, sellable_data, behavioral_insights, metadata, top_cuisines, top_brands, 
                // day_of_week_distribution, time_of_day_curve, price_bucket_distribution, frequent_dishes,
                // favorite_restaurants, competitor_mapping, repeat_baskets, geo_data
                if (col === 'data' || col === 'sellable_data' || col === 'behavioral_insights' || col === 'metadata' ||
                    col === 'top_cuisines' || col === 'top_brands' || col === 'day_of_week_distribution' || 
                    col === 'time_of_day_curve' || col === 'price_bucket_distribution' || col === 'frequent_dishes' ||
                    col === 'favorite_restaurants' || col === 'competitor_mapping' || col === 'repeat_baskets' || 
                    col === 'geo_data') {
                    return `$${i + 1}::jsonb`;
                }
                return `$${i + 1}`;
            }).join(', ');
            
            const query = `INSERT INTO zomato_contributions (${colsStr}) VALUES (${placeholders})`;
            const processedValues = columnList.map((col, idx) => {
                return processValue(col, valueList[idx]);
            });
            
            await pool.query(query, processedValues);
            await pool.end();
        } else if (tableName === 'netflix_contributions') {
            // Build comprehensive INSERT with ALL columns for Netflix (same approach as GitHub)
            const { Pool } = await import('pg');
            const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL });
            
            const colsStr = columnList.join(', ');
            const placeholders = columnList.map((_, i) => {
                const col = columnList[i];
                // JSONB columns: data, sellable_data, behavioral_insights, metadata, top_genres, day_of_week_distribution, time_of_day_curve, movies_watched, top_series
                if (col === 'data' || col === 'sellable_data' || col === 'behavioral_insights' || col === 'metadata' ||
                    col === 'top_genres' || col === 'day_of_week_distribution' || col === 'time_of_day_curve' ||
                    col === 'movies_watched' || col === 'top_series') {
                    return `$${i + 1}::jsonb`;
                }
                return `$${i + 1}`;
            }).join(', ');
            
            const query = `INSERT INTO netflix_contributions (${colsStr}) VALUES (${placeholders})`;
            const processedValues = columnList.map((col, idx) => {
                return processValue(col, valueList[idx]);
            });
            
            await pool.query(query, processedValues);
            await pool.end();
        }
        
        const newContribution = {
            id: contributionId,
            userId,
            walletAddress: data.walletAddress || null,
            data: data.anonymizedData,
            sellableData: data.sellableData || null,
            behavioralInsights: data.behavioralInsights || null,
            dataType,
            reclaimProofId: data.reclaimProofId || null,
            processingMethod: data.processingMethod || 'raw',
            status: 'verified',
            createdAt
        };
        
        // Award points for contribution: 10 for basic, 20 for large data
        const isLargeData = data.isLargeData || false;
        const points = isLargeData ? 20 : 10;
        
        // Note: Points are handled by jsonStorage.addPoints() which is still used
        // This maintains backward compatibility with the existing points system
        
        return { ...newContribution, pointsAwarded: points };
    } catch (error) {
        console.error('Error adding contribution:', error);
        throw error;
    }
};

/**
 * Get all anonymized data for enterprise API
 */
export const getAllAnonymizedData = async () => {
    try {
        const contributions = await getContributions();
        return contributions.map(c => ({
            id: c.id,
            data: c.data,
            dataType: c.dataType,
            timestamp: c.createdAt,
            status: c.status
        }));
    } catch (error) {
        console.error('Error getting anonymized data:', error);
        return [];
    }
};

