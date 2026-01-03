// Helper functions to work with existing table schemas
import { sql } from './dbConfig.js';

/**
 * Get actual columns that exist in a table
 */
export const getTableColumns = async (tableName) => {
    try {
        const result = await sql`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = ${tableName}
            ORDER BY ordinal_position
        `;
        return result.map(r => r.column_name);
    } catch (error) {
        console.error(`Error getting columns for ${tableName}:`, error);
        return [];
    }
};

/**
 * Build SELECT query using only existing columns
 */
export const buildSelectQuery = async (tableName, columns) => {
    const existingColumns = await getTableColumns(tableName);
    const selectColumns = columns.filter(col => existingColumns.includes(col));
    
    if (selectColumns.length === 0) {
        return `SELECT * FROM ${tableName}`;
    }
    
    // Map column names to aliases
    const columnMap = {
        'user_id': 'user_id as "userId"',
        'wallet_address': 'wallet_address as "walletAddress"',
        'sellable_data': 'sellable_data as "sellableData"',
        'behavioral_insights': 'behavioral_insights as "behavioralInsights"',
        'reclaim_proof_id': 'reclaim_proof_id as "reclaimProofId"',
        'processing_method': 'processing_method as "processingMethod"',
        'created_at': 'created_at as "createdAt"'
    };
    
    const selectList = selectColumns.map(col => columnMap[col] || col).join(', ');
    return `SELECT ${selectList} FROM ${tableName}`;
};

/**
 * Build INSERT query using only existing columns
 */
export const buildInsertQuery = async (tableName, data) => {
    const existingColumns = await getTableColumns(tableName);
    
    // Map of column names to values
    const columnValueMap = {
        'id': data.id,
        'user_id': data.userId,
        'wallet_address': data.walletAddress,
        'data': data.anonymizedData ? JSON.stringify(data.anonymizedData) : null,
        'sellable_data': data.sellableData ? JSON.stringify(data.sellableData) : null,
        'behavioral_insights': data.behavioralInsights ? JSON.stringify(data.behavioralInsights) : null,
        'reclaim_proof_id': data.reclaimProofId,
        'processing_method': data.processingMethod || 'raw',
        'status': 'verified',
        'created_at': data.createdAt,
        'updated_at': data.createdAt
    };
    
    // Filter to only existing columns
    const columnsToInsert = Object.keys(columnValueMap).filter(col => existingColumns.includes(col));
    const values = columnsToInsert.map(col => columnValueMap[col]);
    
    const columnsList = columnsToInsert.join(', ');
    const placeholders = columnsToInsert.map((_, i) => `$${i + 1}`).join(', ');
    
    return {
        query: `INSERT INTO ${tableName} (${columnsList}) VALUES (${placeholders})`,
        values: values
    };
};

