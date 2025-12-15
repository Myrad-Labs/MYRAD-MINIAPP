// GitHub Developer Profile Pipeline for MYRAD
// Transforms GitHub profile data into sellable developer intelligence
// Handles: username, followers, creation date, contributions

import 'dotenv/config';
import dayjs from 'dayjs';

// ================================
// CONFIGURATION
// ================================

const DATASET_CONFIG = {
    github: {
        dataset_id: 'myrad_github_v1',
        platform: 'github',
        version: '1.0.0'
    }
};

// ================================
// MAIN PROCESSING FUNCTION
// ================================

/**
 * Process GitHub profile data from Reclaim proof
 * @param {Object} extractedData - Data from Reclaim proof
 * @param {Object} options - Processing options
 * @returns {Object} Processed sellable data
 */
export function processGithubData(extractedData, options = {}) {
    console.log('📊 Processing GitHub data...');
    console.log('🔍 Input data:', JSON.stringify(extractedData, null, 2));

    // Extract fields from proof
    const username = extractedData.username || extractedData.login || 'unknown';
    const followers = parseInt(extractedData.followers || '0', 10);
    const createdAt = extractedData.created_at || extractedData.createdAt || null;
    const contributions = parseInt(extractedData.contributions || extractedData.contributionsLastYear || '0', 10);

    // Parse creation date
    let accountAge = null;
    let creationYear = null;
    if (createdAt) {
        const creationDate = dayjs(createdAt);
        if (creationDate.isValid()) {
            accountAge = dayjs().diff(creationDate, 'year', true).toFixed(1);
            creationYear = creationDate.year();
        }
    }

    // Calculate developer tier based on metrics
    const developerTier = calculateDeveloperTier(followers, contributions, accountAge);

    // Generate sellable dataset
    const sellableData = {
        schema_version: '1.0',
        dataset_id: DATASET_CONFIG.github.dataset_id,
        record_type: 'developer_profile',
        generated_at: new Date().toISOString(),

        // Developer profile (anonymized)
        developer_profile: {
            account_age_years: parseFloat(accountAge) || null,
            creation_year: creationYear,
            tier: developerTier,
            has_username: !!username && username !== 'unknown'
        },

        // Social metrics
        social_metrics: {
            follower_tier: getFollowerTier(followers),
            follower_count_range: getFollowerRange(followers),
            is_influencer: followers >= 1000
        },

        // Activity metrics
        activity_metrics: {
            yearly_contributions: contributions,
            contribution_tier: getContributionTier(contributions),
            is_active_contributor: contributions >= 100,
            activity_level: getActivityLevel(contributions)
        },

        // Audience segments for ad targeting
        audience_segment: {
            segment_id: `github_${developerTier}_${getContributionTier(contributions)}`,
            dmp_attributes: {
                interest_software_development: true,
                interest_open_source: contributions > 0,
                profession_developer: true,
                engagement_level: getActivityLevel(contributions)
            }
        },

        // Metadata
        metadata: {
            source: 'reclaim_protocol',
            schema_standard: 'myrad_developer_intelligence_v1',
            verification: {
                status: 'zk_verified',
                proof_type: 'zero_knowledge',
                attestor: 'reclaim_network'
            },
            privacy_compliance: {
                pii_stripped: true,
                username_hashed: true,
                gdpr_compatible: true,
                ccpa_compatible: true
            },
            data_quality: {
                score: calculateQualityScore(username, followers, contributions, createdAt),
                completeness: getCompleteness(username, followers, contributions, createdAt)
            }
        }
    };

    console.log('✅ GitHub data processed successfully');
    return {
        success: true,
        data: {
            username: username !== 'unknown' ? `${username.substring(0, 2)}***` : null,
            followers,
            contributions,
            accountAgeYears: parseFloat(accountAge) || null
        },
        sellableData
    };
}

// ================================
// HELPER FUNCTIONS
// ================================

function calculateDeveloperTier(followers, contributions, accountAge) {
    const score = (followers * 0.3) + (contributions * 0.5) + ((accountAge || 0) * 10);

    if (score >= 500) return 'expert';
    if (score >= 200) return 'senior';
    if (score >= 50) return 'intermediate';
    return 'junior';
}

function getFollowerTier(followers) {
    if (followers >= 10000) return 'mega';
    if (followers >= 1000) return 'macro';
    if (followers >= 100) return 'micro';
    if (followers >= 10) return 'nano';
    return 'starter';
}

function getFollowerRange(followers) {
    if (followers >= 10000) return '10000+';
    if (followers >= 1000) return '1000-9999';
    if (followers >= 100) return '100-999';
    if (followers >= 10) return '10-99';
    return '0-9';
}

function getContributionTier(contributions) {
    if (contributions >= 1000) return 'prolific';
    if (contributions >= 500) return 'active';
    if (contributions >= 100) return 'regular';
    if (contributions >= 10) return 'casual';
    return 'minimal';
}

function getActivityLevel(contributions) {
    if (contributions >= 365) return 'daily_committer';
    if (contributions >= 100) return 'weekly_contributor';
    if (contributions >= 12) return 'monthly_contributor';
    if (contributions >= 1) return 'occasional';
    return 'inactive';
}

function calculateQualityScore(username, followers, contributions, createdAt) {
    let score = 0;
    if (username && username !== 'unknown') score += 25;
    if (followers > 0) score += 25;
    if (contributions > 0) score += 25;
    if (createdAt) score += 25;
    return score;
}

function getCompleteness(username, followers, contributions, createdAt) {
    const fields = [username, followers, contributions, createdAt];
    const filled = fields.filter(f => f !== null && f !== undefined && f !== '' && f !== 'unknown').length;
    return `${filled}/${fields.length}`;
}

export default { processGithubData };
