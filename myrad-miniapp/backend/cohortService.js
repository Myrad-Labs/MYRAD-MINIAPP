// Cohort Counter Service for k-anonymity compliance
// Tracks cohort membership and validates k-anonymity thresholds
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const COHORTS_FILE = path.join(DATA_DIR, 'cohorts.json');

// Default k-anonymity threshold
const DEFAULT_K_THRESHOLD = 10;

// Initialize cohorts file if it doesn't exist
const initCohortsFile = () => {
    if (!fs.existsSync(COHORTS_FILE)) {
        fs.writeFileSync(COHORTS_FILE, JSON.stringify({}, null, 2));
    }
};

initCohortsFile();

// Read cohorts data
const readCohorts = () => {
    try {
        const data = fs.readFileSync(COHORTS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading cohorts file:', error);
        return {};
    }
};

// Write cohorts data
const writeCohorts = (cohorts) => {
    try {
        fs.writeFileSync(COHORTS_FILE, JSON.stringify(cohorts, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing cohorts file:', error);
        return false;
    }
};

/**
 * Generate a deterministic cohort ID
 * Formula: {platform}_{city_cluster}_{spend_tier}_{frequency_tier}
 */
export const generateDeterministicCohortId = (platform, cityCluster, spendTier, frequencyTier) => {
    const normalizedPlatform = (platform || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedCity = (cityCluster || 'unknown_region').toLowerCase().replace(/[^a-z0-9_]/g, '');
    const normalizedSpend = (spendTier || 'unknown').toLowerCase();
    const normalizedFrequency = (frequencyTier || 'unknown').toLowerCase().replace(/[^a-z0-9_]/g, '');

    return `${normalizedPlatform}_${normalizedCity}_${normalizedSpend}_${normalizedFrequency}`;
};

/**
 * Increment the count for a cohort
 * @param {string} cohortId - The cohort identifier
 * @returns {object} - Updated cohort data
 */
export const incrementCohort = (cohortId) => {
    const cohorts = readCohorts();
    const now = new Date().toISOString();

    if (!cohorts[cohortId]) {
        cohorts[cohortId] = {
            count: 0,
            created_at: now,
            last_updated: now,
            k_anonymity_compliant: false,
            first_compliant_at: null
        };
    }

    cohorts[cohortId].count += 1;
    cohorts[cohortId].last_updated = now;

    // Check k-anonymity compliance
    const wasCompliant = cohorts[cohortId].k_anonymity_compliant;
    cohorts[cohortId].k_anonymity_compliant = cohorts[cohortId].count >= DEFAULT_K_THRESHOLD;

    // Record when cohort first became compliant
    if (!wasCompliant && cohorts[cohortId].k_anonymity_compliant) {
        cohorts[cohortId].first_compliant_at = now;
        console.log(`🎉 Cohort ${cohortId} is now k-anonymity compliant (${cohorts[cohortId].count} members)`);
    }

    writeCohorts(cohorts);

    return cohorts[cohortId];
};

/**
 * Get the count for a specific cohort
 * @param {string} cohortId - The cohort identifier
 * @returns {number} - The count of members in the cohort
 */
export const getCohortCount = (cohortId) => {
    const cohorts = readCohorts();
    return cohorts[cohortId]?.count || 0;
};

/**
 * Get cohort details
 * @param {string} cohortId - The cohort identifier
 * @returns {object|null} - Cohort data or null if not found
 */
export const getCohortDetails = (cohortId) => {
    const cohorts = readCohorts();
    return cohorts[cohortId] || null;
};

/**
 * Get all cohorts with their counts
 * @returns {object} - All cohorts data
 */
export const getAllCohorts = () => {
    return readCohorts();
};

/**
 * Get all cohorts that meet k-anonymity threshold
 * @param {number} threshold - Minimum members required (default: DEFAULT_K_THRESHOLD)
 * @returns {object} - Cohorts meeting the threshold
 */
export const getCompliantCohorts = (threshold = DEFAULT_K_THRESHOLD) => {
    const cohorts = readCohorts();
    const compliant = {};

    for (const [cohortId, data] of Object.entries(cohorts)) {
        if (data.count >= threshold) {
            compliant[cohortId] = data;
        }
    }

    return compliant;
};

/**
 * Check if a cohort meets k-anonymity threshold
 * @param {string} cohortId - The cohort identifier
 * @param {number} threshold - Minimum members required (default: DEFAULT_K_THRESHOLD)
 * @returns {boolean} - Whether cohort is k-anonymous
 */
export const checkKAnonymity = (cohortId, threshold = DEFAULT_K_THRESHOLD) => {
    const count = getCohortCount(cohortId);
    return count >= threshold;
};

/**
 * Get cohort statistics summary
 * @returns {object} - Summary statistics
 */
export const getCohortStats = () => {
    const cohorts = readCohorts();
    const cohortIds = Object.keys(cohorts);

    const stats = {
        total_cohorts: cohortIds.length,
        total_profiles: 0,
        compliant_cohorts: 0,
        non_compliant_cohorts: 0,
        largest_cohort: null,
        largest_cohort_size: 0,
        smallest_cohort: null,
        smallest_cohort_size: Infinity,
        average_cohort_size: 0
    };

    for (const [cohortId, data] of Object.entries(cohorts)) {
        stats.total_profiles += data.count;

        if (data.k_anonymity_compliant) {
            stats.compliant_cohorts++;
        } else {
            stats.non_compliant_cohorts++;
        }

        if (data.count > stats.largest_cohort_size) {
            stats.largest_cohort = cohortId;
            stats.largest_cohort_size = data.count;
        }

        if (data.count < stats.smallest_cohort_size) {
            stats.smallest_cohort = cohortId;
            stats.smallest_cohort_size = data.count;
        }
    }

    if (cohortIds.length > 0) {
        stats.average_cohort_size = Math.round(stats.total_profiles / cohortIds.length * 10) / 10;
    }

    if (stats.smallest_cohort_size === Infinity) {
        stats.smallest_cohort_size = 0;
    }

    return stats;
};

export const K_THRESHOLD = DEFAULT_K_THRESHOLD;
