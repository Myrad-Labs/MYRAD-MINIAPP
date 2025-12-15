// Simple JSON file storage helper
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// File paths
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const POINTS_FILE = path.join(DATA_DIR, 'points.json');
const CONTRIBUTIONS_FILE = path.join(DATA_DIR, 'contributions.json'); // Legacy - for backwards compat
const API_KEYS_FILE = path.join(DATA_DIR, 'api_keys.json');

// Provider-specific contribution paths
const ZOMATO_CONTRIBUTIONS_FILE = path.join(DATA_DIR, 'zomato', 'contributions.json');
const GITHUB_CONTRIBUTIONS_FILE = path.join(DATA_DIR, 'github', 'contributions.json');

// Ensure provider directories exist
const ZOMATO_DIR = path.join(DATA_DIR, 'zomato');
const GITHUB_DIR = path.join(DATA_DIR, 'github');
if (!fs.existsSync(ZOMATO_DIR)) fs.mkdirSync(ZOMATO_DIR, { recursive: true });
if (!fs.existsSync(GITHUB_DIR)) fs.mkdirSync(GITHUB_DIR, { recursive: true });

// Initialize files if they don't exist
const initFile = (filePath, defaultData = []) => {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    }
};

initFile(USERS_FILE, []);
initFile(POINTS_FILE, []);
initFile(CONTRIBUTIONS_FILE, []); // Legacy
initFile(API_KEYS_FILE, []);
initFile(ZOMATO_CONTRIBUTIONS_FILE, []);
initFile(GITHUB_CONTRIBUTIONS_FILE, []);

// Read JSON file
const readJSON = (filePath) => {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
        return [];
    }
};

// Write JSON file
const writeJSON = (filePath, data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Error writing ${filePath}:`, error);
        return false;
    }
};

// Users
export const getUsers = () => readJSON(USERS_FILE);
export const saveUsers = (users) => writeJSON(USERS_FILE, users);

// Check if username is available
export const isUsernameAvailable = (username) => {
    const users = getUsers();
    return !users.some(u => u.username && u.username.toLowerCase() === username.toLowerCase());
};

export const getUserByPrivyId = (privyId) => {
    const users = getUsers();
    return users.find(u => u.privyId === privyId);
};

export const getUserById = (userId) => {
    const users = getUsers();
    return users.find(u => u.id === userId);
};

export const getUserByWallet = (walletAddress) => {
    const users = getUsers();
    return users.find(u => u.walletAddress === walletAddress);
};

export const createUser = (walletAddress, email = 'user') => {
    const users = getUsers();
    const newUser = {
        id: Date.now().toString(),
        privyId: walletAddress, // For backward compatibility
        email,
        walletAddress,
        username: null,
        streak: 0,
        lastContributionDate: null,
        totalPoints: 10, // Connect bonus: 10 points
        league: 'Bronze',
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString()
    };
    users.push(newUser);
    saveUsers(users);

    // Award connect points: 10 points
    addPoints(newUser.id, 10, 'wallet_connect');

    return newUser;
};

export const updateUserWallet = (userId, walletAddress) => {
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
        users[userIndex].walletAddress = walletAddress;
        saveUsers(users);
        return users[userIndex];
    }
    return null;
};

export const updateUserActivity = (userId) => {
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
        users[userIndex].lastActiveAt = new Date().toISOString();
        saveUsers(users);
    }
};

export const updateUserProfile = (userId, updates) => {
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
        users[userIndex] = { ...users[userIndex], ...updates };
        saveUsers(users);
        return users[userIndex];
    }
    return null;
};

// Points
export const getPoints = () => readJSON(POINTS_FILE);
export const savePoints = (points) => writeJSON(POINTS_FILE, points);

export const getUserPoints = (userId) => {
    const points = getPoints();
    return points.filter(p => p.userId === userId);
};

export const getUserTotalPoints = (userId) => {
    const userPoints = getUserPoints(userId);
    return userPoints.reduce((sum, p) => sum + p.points, 0);
};

export const addPoints = (userId, points, reason) => {
    const pointsData = getPoints();
    const newEntry = {
        id: Date.now().toString(),
        userId,
        points,
        reason,
        createdAt: new Date().toISOString()
    };
    pointsData.push(newEntry);
    savePoints(pointsData);

    // Update user's total points
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
        users[userIndex].totalPoints = getUserTotalPoints(userId);
        saveUsers(users);
    }

    return newEntry;
};

export const getLeaderboard = (limit = 10) => {
    const users = getUsers();
    return users
        .sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0))
        .slice(0, limit)
        .map(u => ({
            id: u.id,
            email: u.email, // Kept for admin view flexibility
            username: u.username || `User ${u.id.substr(-4)}`,
            totalPoints: u.totalPoints || 0,
            league: u.league || 'Bronze',
            streak: u.streak || 0,
            createdAt: u.createdAt
        }));
};

export const getWeeklyLeaderboard = (limit = 10) => {
    const users = getUsers();
    const points = getPoints();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Calculate weekly points per user
    const weeklyPoints = points
        .filter(p => new Date(p.createdAt) > oneWeekAgo)
        .reduce((acc, p) => {
            acc[p.userId] = (acc[p.userId] || 0) + p.points;
            return acc;
        }, {});

    // Sort users by weekly points
    return Object.entries(weeklyPoints)
        .sort(([, pointsA], [, pointsB]) => pointsB - pointsA)
        .slice(0, limit)
        .map(([userId, wPoints]) => {
            const user = users.find(u => u.id === userId);
            if (!user) return null;
            return {
                id: user.id,
                username: user.username || `User ${user.id.substr(-4)}`,
                weeklyPoints: wPoints,
                totalPoints: user.totalPoints || 0,
                league: user.league || 'Bronze'
            };
        })
        .filter(u => u !== null);
};

// Helper to get contribution file based on dataType
const getContributionFile = (dataType) => {
    if (dataType === 'zomato_order_history') return ZOMATO_CONTRIBUTIONS_FILE;
    if (dataType === 'github_profile') return GITHUB_CONTRIBUTIONS_FILE;
    return CONTRIBUTIONS_FILE; // Fallback to legacy
};

// Contributions - now provider-specific
export const getContributions = (dataType = null) => {
    if (dataType) {
        return readJSON(getContributionFile(dataType));
    }
    // Return all contributions from all providers
    const zomato = readJSON(ZOMATO_CONTRIBUTIONS_FILE);
    const github = readJSON(GITHUB_CONTRIBUTIONS_FILE);
    const legacy = readJSON(CONTRIBUTIONS_FILE);
    return [...zomato, ...github, ...legacy];
};

export const saveContributions = (contributions, dataType = null) => {
    if (dataType) {
        return writeJSON(getContributionFile(dataType), contributions);
    }
    // Legacy fallback
    return writeJSON(CONTRIBUTIONS_FILE, contributions);
};

export const getUserContributions = (userId) => {
    const contributions = getContributions();
    return contributions.filter(c => c.userId === userId);
};

// Alias for compatibility
export const getContributionsByUserId = getUserContributions;

// Get cohort size for k-anonymity compliance
export const getCohortSize = (cohortId) => {
    const contributions = getContributions();
    return contributions.filter(c =>
        c.sellableData?.audience_segment?.segment_id === cohortId
    ).length;
};

// Get all unique cohorts with their sizes
export const getCohortSizes = () => {
    const contributions = getContributions();
    const cohortCounts = {};

    contributions.forEach(c => {
        const cohortId = c.sellableData?.audience_segment?.segment_id;
        if (cohortId) {
            cohortCounts[cohortId] = (cohortCounts[cohortId] || 0) + 1;
        }
    });

    return cohortCounts;
};

export const addContribution = (userId, data) => {
    const dataType = data.dataType || 'general';
    const contributions = getContributions(dataType);
    const newContribution = {
        id: Date.now().toString(),
        userId,
        walletAddress: data.walletAddress || null,  // Store wallet with contribution
        data: data.anonymizedData,
        sellableData: data.sellableData || null,  // Enterprise-ready format
        behavioralInsights: data.behavioralInsights || null,
        dataType,
        reclaimProofId: data.reclaimProofId || null,
        processingMethod: data.processingMethod || 'raw',
        status: 'verified',
        createdAt: new Date().toISOString()
    };
    contributions.push(newContribution);
    saveContributions(contributions, dataType);

    // Award points for contribution: 10 for basic, 20 for large data
    const isLargeData = data.isLargeData || false;
    const points = isLargeData ? 20 : 10;
    addPoints(userId, points, 'data_contribution');

    return { ...newContribution, pointsAwarded: points };
};

// Get all anonymized data for enterprise API
export const getAllAnonymizedData = () => {
    const contributions = getContributions();
    return contributions.map(c => ({
        id: c.id,
        data: c.data,
        dataType: c.dataType,
        timestamp: c.createdAt,
        status: c.status
    }));
};

// API Keys
export const getApiKeys = () => readJSON(API_KEYS_FILE);
export const saveApiKeys = (keys) => writeJSON(API_KEYS_FILE, keys);

export const generateApiKey = (name) => {
    const keys = getApiKeys();
    const newKey = {
        id: Date.now().toString(),
        key: `myrad_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
        name,
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
        isActive: true
    };
    keys.push(newKey);
    saveApiKeys(keys);
    return newKey;
};

export const validateApiKey = (key) => {
    const keys = getApiKeys();
    const apiKey = keys.find(k => k.key === key && k.isActive);

    if (apiKey) {
        // Update last used timestamp
        const keyIndex = keys.findIndex(k => k.key === key);
        keys[keyIndex].lastUsedAt = new Date().toISOString();
        saveApiKeys(keys);
    }

    return !!apiKey;
};

export const updateApiKeyUsage = (key) => {
    const keys = getApiKeys();
    const keyIndex = keys.findIndex(k => k.key === key);
    if (keyIndex !== -1) {
        keys[keyIndex].lastUsedAt = new Date().toISOString();
        saveApiKeys(keys);
    }
};
