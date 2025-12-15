// Schema Validator Service using Ajv
// Validates sellable data structure before saving
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Ajv with formats
const ajv = new Ajv({
    allErrors: true,
    verbose: true,
    coerceTypes: true
});

// Try to add formats, but don't fail if not available
try {
    addFormats(ajv);
} catch (e) {
    console.warn('ajv-formats not available, using basic validation');
}

// Load the sellable data schema
let sellableDataSchema = null;
try {
    const schemaPath = path.join(__dirname, 'schemas', 'sellableDataSchema.json');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    sellableDataSchema = JSON.parse(schemaContent);
    console.log('✅ Sellable data schema loaded');
} catch (error) {
    console.error('⚠️ Could not load sellable data schema:', error.message);
}

// Compile the schema
let validateSellableDataFn = null;
if (sellableDataSchema) {
    try {
        validateSellableDataFn = ajv.compile(sellableDataSchema);
    } catch (error) {
        console.error('⚠️ Could not compile sellable data schema:', error.message);
    }
}

/**
 * Validate sellable data against the schema
 * @param {object} data - The sellable data to validate
 * @returns {object} - { valid: boolean, errors: array, errorSummary: string }
 */
export const validateSellableData = (data) => {
    if (!validateSellableDataFn) {
        console.warn('⚠️ Schema validator not available, skipping validation');
        return { valid: true, errors: [], errorSummary: 'Schema validation skipped' };
    }

    const valid = validateSellableDataFn(data);

    if (valid) {
        return {
            valid: true,
            errors: [],
            errorSummary: null
        };
    }

    // Format errors for readability
    const errors = validateSellableDataFn.errors.map(err => ({
        path: err.instancePath || '/',
        message: err.message,
        keyword: err.keyword,
        params: err.params
    }));

    const errorSummary = errors.map(e => `${e.path}: ${e.message}`).join('; ');

    return {
        valid: false,
        errors,
        errorSummary
    };
};

/**
 * Validate and throw if invalid
 * @param {object} data - The sellable data to validate
 * @throws {Error} - If validation fails
 */
export const validateOrThrow = (data) => {
    const result = validateSellableData(data);
    if (!result.valid) {
        const error = new Error(`Schema validation failed: ${result.errorSummary}`);
        error.validationErrors = result.errors;
        throw error;
    }
    return true;
};

/**
 * Get validation status for a data object
 * @param {object} data - The sellable data to check
 * @returns {object} - Validation status with details
 */
export const getValidationStatus = (data) => {
    const result = validateSellableData(data);

    return {
        is_valid: result.valid,
        error_count: result.errors.length,
        errors: result.errors,
        schema_version: sellableDataSchema?.$id || 'unknown',
        validated_at: new Date().toISOString()
    };
};

/**
 * Check if a specific field exists and is valid
 * @param {object} data - The data object
 * @param {string} fieldPath - Dot-separated path to field
 * @returns {object} - { exists: boolean, value: any, type: string }
 */
export const checkField = (data, fieldPath) => {
    const parts = fieldPath.split('.');
    let current = data;

    for (const part of parts) {
        if (current === undefined || current === null) {
            return { exists: false, value: undefined, type: 'undefined' };
        }
        current = current[part];
    }

    return {
        exists: current !== undefined,
        value: current,
        type: Array.isArray(current) ? 'array' : typeof current
    };
};

/**
 * List all required fields that are missing
 * @param {object} data - The data object
 * @returns {array} - List of missing required field paths
 */
export const getMissingRequiredFields = (data) => {
    const requiredPaths = [
        'schema_version',
        'dataset_id',
        'record_type',
        'generated_at',
        'audience_segment.segment_id',
        'audience_segment.iab_categories',
        'audience_segment.dmp_attributes',
        'transaction_data.summary.total_orders',
        'transaction_data.summary.currency',
        'transaction_data.frequency_metrics.frequency_tier',
        'transaction_data.recency.rfm_recency_score',
        'metadata.source',
        'metadata.verification.status',
        'metadata.privacy_compliance.pii_stripped',
        'metadata.data_quality.score'
    ];

    const missing = [];

    for (const path of requiredPaths) {
        const result = checkField(data, path);
        if (!result.exists) {
            missing.push(path);
        }
    }

    return missing;
};

export { sellableDataSchema };
