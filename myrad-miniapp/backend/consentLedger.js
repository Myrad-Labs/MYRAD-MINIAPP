// Consent Ledger Service for PII Audit & Compliance
// Maintains an immutable log of all data ingestions for audit purposes
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const CONSENT_LEDGER_FILE = path.join(DATA_DIR, 'consent_ledger.json');

// Salt for hashing user IDs (should be in env in production)
const HASH_SALT = process.env.CONSENT_HASH_SALT || 'myrad_consent_salt_2024';

// Initialize consent ledger file if it doesn't exist
const initLedgerFile = () => {
    if (!fs.existsSync(CONSENT_LEDGER_FILE)) {
        fs.writeFileSync(CONSENT_LEDGER_FILE, JSON.stringify([], null, 2));
    }
};

initLedgerFile();

// Read consent ledger
const readLedger = () => {
    try {
        const data = fs.readFileSync(CONSENT_LEDGER_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading consent ledger:', error);
        return [];
    }
};

// Write consent ledger (append-only in spirit)
const writeLedger = (entries) => {
    try {
        fs.writeFileSync(CONSENT_LEDGER_FILE, JSON.stringify(entries, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing consent ledger:', error);
        return false;
    }
};

/**
 * Hash a user ID with salt for privacy
 * @param {string} userId - The user's ID
 * @returns {string} - SHA-256 hashed user ID
 */
const hashUserId = (userId) => {
    return crypto
        .createHash('sha256')
        .update(HASH_SALT + userId)
        .digest('hex');
};

/**
 * Generate a unique ledger entry ID
 * @returns {string} - Unique entry ID
 */
const generateEntryId = () => {
    return `consent_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
};

/**
 * Log a consent/data ingestion entry
 * @param {object} params - Consent entry parameters
 * @returns {object} - The logged consent entry
 */
export const logConsent = ({
    userId,
    reclaimProofId,
    dataType,
    datasetSource,
    geoRegion,
    cohortId,
    contributionId,
    orderCount,
    dataWindowStart,
    dataWindowEnd,
    walletAddress
}) => {
    const entries = readLedger();

    const entry = {
        id: generateEntryId(),
        timestamp: new Date().toISOString(),

        // Privacy-preserving identifiers
        hashed_user_id: hashUserId(userId),
        hashed_wallet: walletAddress ? hashUserId(walletAddress) : null,
        proof_id: reclaimProofId || null,

        // Data source info
        dataset_source: datasetSource || 'reclaim_protocol',
        data_type: dataType || 'unknown',

        // Anonymized geo
        geo_region: geoRegion || 'unknown',

        // Cohort assignment
        cohort_id: cohortId || null,
        contribution_id: contributionId || null,

        // Data coverage (for audit)
        data_summary: {
            order_count: orderCount || 0,
            data_window_start: dataWindowStart || null,
            data_window_end: dataWindowEnd || null
        },

        // Consent metadata
        consent_type: 'explicit_contribution',
        consent_scope: ['anonymized_behavioral_data', 'aggregated_insights'],
        revocable: true,

        // Verification
        verification: {
            method: reclaimProofId ? 'zk_proof' : 'self_reported',
            verified: !!reclaimProofId
        }
    };

    entries.push(entry);
    writeLedger(entries);

    console.log(`📋 Consent logged: ${entry.id} for ${entry.data_type}`);

    return entry;
};

/**
 * Get all consent entries for a hashed user ID
 * @param {string} userId - The user's ID (will be hashed)
 * @returns {array} - Consent entries for the user
 */
export const getConsentEntriesByUser = (userId) => {
    const entries = readLedger();
    const hashedId = hashUserId(userId);
    return entries.filter(e => e.hashed_user_id === hashedId);
};

/**
 * Get all consent entries for a specific proof
 * @param {string} proofId - The Reclaim proof ID
 * @returns {object|null} - Consent entry or null
 */
export const getConsentByProofId = (proofId) => {
    const entries = readLedger();
    return entries.find(e => e.proof_id === proofId) || null;
};

/**
 * Get consent ledger statistics
 * @returns {object} - Statistics about the consent ledger
 */
export const getConsentStats = () => {
    const entries = readLedger();

    const stats = {
        total_entries: entries.length,
        unique_users: new Set(entries.map(e => e.hashed_user_id)).size,
        by_data_type: {},
        by_geo_region: {},
        by_consent_type: {},
        verified_count: 0,
        date_range: {
            earliest: null,
            latest: null
        }
    };

    entries.forEach(entry => {
        // Count by data type
        stats.by_data_type[entry.data_type] = (stats.by_data_type[entry.data_type] || 0) + 1;

        // Count by geo region
        stats.by_geo_region[entry.geo_region] = (stats.by_geo_region[entry.geo_region] || 0) + 1;

        // Count by consent type
        stats.by_consent_type[entry.consent_type] = (stats.by_consent_type[entry.consent_type] || 0) + 1;

        // Count verified
        if (entry.verification?.verified) {
            stats.verified_count++;
        }

        // Track date range
        const entryDate = new Date(entry.timestamp);
        if (!stats.date_range.earliest || entryDate < new Date(stats.date_range.earliest)) {
            stats.date_range.earliest = entry.timestamp;
        }
        if (!stats.date_range.latest || entryDate > new Date(stats.date_range.latest)) {
            stats.date_range.latest = entry.timestamp;
        }
    });

    return stats;
};

/**
 * Export consent ledger for audit (with optional date filter)
 * @param {string} startDate - Optional start date filter
 * @param {string} endDate - Optional end date filter
 * @returns {array} - Filtered consent entries
 */
export const exportForAudit = (startDate = null, endDate = null) => {
    const entries = readLedger();

    if (!startDate && !endDate) {
        return entries;
    }

    return entries.filter(entry => {
        const entryDate = new Date(entry.timestamp);
        const start = startDate ? new Date(startDate) : new Date(0);
        const end = endDate ? new Date(endDate) : new Date();

        return entryDate >= start && entryDate <= end;
    });
};

/**
 * Check if a proof has already been used (duplicate prevention)
 * @param {string} proofId - The Reclaim proof ID
 * @returns {boolean} - Whether proof already exists in ledger
 */
export const isProofAlreadyUsed = (proofId) => {
    if (!proofId) return false;
    const entries = readLedger();
    return entries.some(e => e.proof_id === proofId);
};
