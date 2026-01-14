// MVP API Routes for MYRAD
import express from 'express';
import * as jsonStorage from './jsonStorage.js';
import * as dbStorage from './dbStorage.js';
import { sql } from './dbConfig.js';
import * as cohortService from './cohortService.js';
import * as consentLedger from './consentLedger.js';
import * as rewardService from './rewardService.js';


const router = express.Router();

// ===================
// RECLAIM WEBHOOK ENDPOINT
// ===================
// Receives proofs directly from Reclaim Protocol after external verification
router.post('/reclaim/callback', async (req, res) => {
    console.log('📥 Reclaim callback received');
    console.log('📦 Raw Body:', JSON.stringify(req.body, null, 2));
    console.log('📦 Content-Type:', req.headers['content-type']);

    try {
        let proofData = null;
        let contextData = null;

        // Handle different Reclaim payload formats
        // Format 1: { proofs: [...], context: "..." }
        // Format 2: { proof: {...}, context: "..." }  
        // Format 3: URL-encoded proof string
        // Format 4: Direct proof object at root level

        if (req.body.proofs && Array.isArray(req.body.proofs) && req.body.proofs.length > 0) {
            proofData = req.body.proofs[0];
            contextData = req.body.context;
            console.log('📋 Format: proofs array');
        } else if (req.body.proof) {
            proofData = req.body.proof;
            contextData = req.body.context;
            console.log('📋 Format: single proof object');
        } else if (req.body.claimData) {
            // Direct proof object at root
            proofData = req.body;
            contextData = req.body.context;
            console.log('📋 Format: direct proof at root');
        } else if (typeof req.body === 'string') {
            // URL-encoded string
            try {
                proofData = JSON.parse(decodeURIComponent(req.body));
                console.log('📋 Format: URL-encoded string');
            } catch (e) {
                console.log('⚠️ Could not parse URL-encoded body');
            }
        } else if (Object.keys(req.body).length > 0) {
            // Try to find proof-like data in the body
            const bodyKeys = Object.keys(req.body);
            console.log('📋 Body keys:', bodyKeys);

            // Accept the full body as proof data for debugging
            proofData = req.body;
            contextData = req.body.context || req.body.sessionData;
            console.log('📋 Format: accepting full body as proof');
        }

        if (!proofData) {
            console.log('⚠️ No proof data found in any format');
            console.log('⚠️ Raw body type:', typeof req.body);
            console.log('⚠️ Raw body keys:', Object.keys(req.body || {}));
            return res.status(400).json({
                error: 'No proofs provided',
                receivedKeys: Object.keys(req.body || {}),
                bodyType: typeof req.body
            });
        }

        // Parse context to get user info
        let sessionData = {};
        if (contextData) {
            try {
                sessionData = typeof contextData === 'string' ? JSON.parse(contextData) : contextData;
            } catch (e) {
                console.log('⚠️ Could not parse context:', contextData);
            }
        }

        const { walletAddress, provider, dataType } = sessionData;
        console.log(`📋 Session data: wallet=${walletAddress}, provider=${provider}`);

        // Extract data from proof
        let extractedData = {};
        let proofId = `proof_${Date.now()}`;

        if (typeof proofData === 'object' && proofData !== null) {
            proofId = proofData.identifier || proofData.id || proofId;

            // Extract from claimData.context
            if (proofData.claimData?.context) {
                try {
                    const ctx = typeof proofData.claimData.context === 'string'
                        ? JSON.parse(proofData.claimData.context)
                        : proofData.claimData.context;

                    if (ctx.extractedParameters) {
                        extractedData = { ...extractedData, ...ctx.extractedParameters };
                    }
                } catch (e) {
                    console.warn('Could not parse proof context');
                }
            }

            if (proofData.extractedParameterValues) {
                extractedData = { ...extractedData, ...proofData.extractedParameterValues };
            }

            // Fallback: store raw proof data
            if (Object.keys(extractedData).length === 0) {
                extractedData = { rawProof: proofData };
            }
        }

        console.log('📦 Extracted data:', JSON.stringify(extractedData, null, 2));

        // Store pending contribution even without wallet (will match by provider)
        const pendingKey = walletAddress
            ? `pending_${walletAddress}_${provider || 'unknown'}`
            : `pending_latest_${provider || Date.now()}`;

        global.pendingContributions = global.pendingContributions || {};
        global.pendingContributions[pendingKey] = {
            proofId,
            data: extractedData,
            dataType: dataType || `${provider}_data`,
            provider: provider || 'unknown',
            walletAddress: walletAddress || null,
            timestamp: Date.now(),
            rawProof: proofData
        };

        // Also store by proof ID for lookup
        global.pendingContributions[`proof_${proofId}`] = global.pendingContributions[pendingKey];

        console.log(`✅ Stored pending contribution: ${pendingKey}`);

        res.json({ success: true, message: 'Proof received', proofId });
    } catch (error) {
        console.error('❌ Reclaim callback error:', error);
        res.status(500).json({ error: 'Failed to process proof', details: error.message });
    }
});

// Poll for pending contribution (used by frontend after returning from Reclaim)
router.get('/reclaim/pending/:walletAddress/:provider', (req, res) => {
    const { walletAddress, provider } = req.params;
    const pendingKey = `pending_${walletAddress}_${provider}`;

    console.log(`🔍 Checking pending contribution: ${pendingKey}`);

    const pending = global.pendingContributions?.[pendingKey];

    if (pending) {
        // Remove after retrieval
        delete global.pendingContributions[pendingKey];
        console.log(`✅ Found and returned pending contribution`);
        return res.json({ success: true, contribution: pending });
    }

    // Try to find any recent pending contribution
    const allPending = global.pendingContributions || {};
    const recentKey = Object.keys(allPending).find(k =>
        k.includes(provider) &&
        allPending[k].timestamp > Date.now() - 120000 // Within last 2 minutes
    );

    if (recentKey) {
        const recentPending = allPending[recentKey];
        delete global.pendingContributions[recentKey];
        console.log(`✅ Found recent pending contribution: ${recentKey}`);
        return res.json({ success: true, contribution: recentPending });
    }

    res.json({ success: false, message: 'No pending contribution found' });
});

// Middleware to verify wallet token (Farcaster wallet connect)
// Token format: "wallet_0xADDRESS" or "privy_0xADDRESS_user"
const verifyWalletToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization token' });
    }

    const token = authHeader.split(' ')[1];

    try {
        let walletAddress = null;

        // Support multiple token formats
        if (token.startsWith('wallet_')) {
            // Format: wallet_0xADDRESS
            walletAddress = token.replace('wallet_', '');
        } else if (token.startsWith('privy_')) {
            // Legacy format: privy_0xADDRESS_user
            const parts = token.split('_');
            walletAddress = parts[1];
        } else if (token.startsWith('0x')) {
            // Direct wallet address
            walletAddress = token;
        }

        if (!walletAddress || !walletAddress.startsWith('0x')) {
            return res.status(401).json({ error: 'Invalid token format - wallet address required' });
        }

        req.user = {
            walletAddress: walletAddress,
            privyId: walletAddress // For backward compatibility
        };
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// Alias for backward compatibility
const verifyPrivyToken = verifyWalletToken;

// Middleware to verify API key for enterprise endpoints
const verifyApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
    }

    const isValid = jsonStorage.validateApiKey(apiKey);
    if (!isValid) {
        return res.status(401).json({ error: 'Invalid or inactive API key' });
    }

    next();
};

// ===================
// USER ENDPOINTS
// ===================

// Set user username
router.post('/user/username', verifyPrivyToken, (req, res) => {
    try {
        const user = jsonStorage.getUserByPrivyId(req.user.privyId);
        const { username } = req.body;

        if (!user) return res.status(404).json({ error: 'User not found' });
        if (!username || username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
        if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });

        if (jsonStorage.isUsernameAvailable(username)) {
            const updatedUser = jsonStorage.updateUserProfile(user.id, { username });
            res.json({ success: true, username: updatedUser.username });
        } else {
            res.status(409).json({ error: 'Username already taken' });
        }
    } catch (error) {
        console.error('Set username error:', error);
        res.status(500).json({ error: 'Failed to set username' });
    }
});

// Verify wallet token and get/create user
router.post('/auth/verify', verifyPrivyToken, (req, res) => {
    try {
        const walletAddress = req.user.walletAddress;

        // Try to find user by wallet address first, then by privyId
        let user = jsonStorage.getUserByWallet(walletAddress) ||
            jsonStorage.getUserByPrivyId(walletAddress);

        if (!user) {
            // Create new user with wallet address
            user = jsonStorage.createUser(walletAddress, 'user');
            // Update wallet address
            jsonStorage.updateUserWallet(user.id, walletAddress);
            console.log(`👤 New user created: ${user.id} with wallet ${walletAddress}`);
        } else {
            jsonStorage.updateUserActivity(user.id);
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                walletAddress: user.walletAddress || walletAddress,
                username: user.username,
                totalPoints: user.totalPoints || 0,
                league: user.league || 'Bronze',
                streak: user.streak || 0,
                createdAt: user.createdAt,
                lastActiveAt: user.lastActiveAt
            }
        });
    } catch (error) {
        console.error('Auth verify error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

// Get user profile
router.get('/user/profile', verifyPrivyToken, async (req, res) => {
    try {
        const user = jsonStorage.getUserByPrivyId(req.user.privyId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const contributions = await dbStorage.getUserContributions(user.id);

        res.json({
            success: true,
            profile: {
                id: user.id,
                email: user.email,
                username: user.username,
                totalPoints: user.totalPoints || 0,
                league: user.league || 'Bronze',
                streak: user.streak || 0,
                contributionsCount: contributions.length,
                createdAt: user.createdAt,
                lastActiveAt: user.lastActiveAt
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Get user points balance and history
router.get('/user/points', verifyPrivyToken, (req, res) => {
    try {
        const user = jsonStorage.getUserByPrivyId(req.user.privyId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const pointsHistory = jsonStorage.getUserPoints(user.id);
        const totalPoints = jsonStorage.getUserTotalPoints(user.id);

        res.json({
            success: true,
            points: {
                balance: totalPoints,
                history: pointsHistory.sort((a, b) =>
                    new Date(b.createdAt) - new Date(a.createdAt)
                ).slice(0, 50) // Last 50 transactions
            }
        });
    } catch (error) {
        console.error('Get points error:', error);
        res.status(500).json({ error: 'Failed to fetch points' });
    }
});

// Get user contributions
router.get('/user/contributions', verifyPrivyToken, async (req, res) => {
    try {
        const user = jsonStorage.getUserByPrivyId(req.user.privyId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const contributions = await dbStorage.getUserContributions(user.id);

        res.json({
            success: true,
            contributions: contributions.sort((a, b) =>
                new Date(b.createdAt) - new Date(a.createdAt)
            )
        });
    } catch (error) {
        console.error('Get contributions error:', error);
        res.status(500).json({ error: 'Failed to fetch contributions' });
    }
});

// Submit data contribution with enterprise data pipeline
router.post('/contribute', verifyPrivyToken, async (req, res) => {
    try {
        const user = jsonStorage.getUserByPrivyId(req.user.privyId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { anonymizedData, dataType, reclaimProofId } = req.body;

        if (!anonymizedData) {
            return res.status(400).json({ error: 'anonymizedData is required' });
        }

        // Extract wallet address from the data if present
        const walletAddress = anonymizedData?.walletAddress || null;
        if (walletAddress && !user.walletAddress) {
            jsonStorage.updateUserWallet(user.id, walletAddress);
            console.log(`💳 Wallet address updated for user ${user.id}: ${walletAddress}`);
        }

        // ========================================
        // DUPLICATE SUBMISSION PREVENTION
        // ========================================
        // Check if this exact proof has already been submitted
        if (reclaimProofId) {
            const existingContributions = await dbStorage.getContributionsByUserId(user.id);
            const duplicateProof = existingContributions.find(c => c.reclaimProofId === reclaimProofId);

            if (duplicateProof) {
                console.log(`⚠️ Duplicate submission blocked: proofId ${reclaimProofId} already exists`);
                return res.status(409).json({
                    error: 'Duplicate submission',
                    message: 'This data has already been submitted. You cannot earn points for the same data twice.',
                    existingContributionId: duplicateProof.id
                });
            }
        }

        // Check for similar data submission within 24 hours (content-based dedup)
        const recentContributions = (await dbStorage.getContributionsByUserId(user.id))
            .filter(c => c.dataType === dataType)
            .filter(c => new Date() - new Date(c.createdAt) < 24 * 60 * 60 * 1000); // Last 24 hours

        if (recentContributions.length > 0) {
            // Calculate a simple hash of the order count to detect similar data
            const orderCount = anonymizedData?.orders?.length || 0;
            const similarSubmission = recentContributions.find(c => {
                const existingOrderCount = c.data?.orderCount || 0;
                // If order counts match exactly, likely duplicate data
                return Math.abs(existingOrderCount - orderCount) < 3;
            });

            if (similarSubmission) {
                console.log(`⚠️ Similar data submission blocked within 24h for user ${user.id}`);
                return res.status(429).json({
                    error: 'Rate limited',
                    message: 'You have already submitted similar data in the last 24 hours. Please wait before submitting again.',
                    retryAfter: new Date(new Date(similarSubmission.createdAt).getTime() + 24 * 60 * 60 * 1000).toISOString()
                });
            }
        }

        let sellableData = null;
        let processedData = anonymizedData;
        let behavioralInsights = null;

        // Process Zomato data through enterprise pipeline
        if (dataType === 'zomato_order_history') {
            try {
                const { transformToSellableData } = await import('./zomatoPipeline.js');

                console.log('📦 Processing zomato data through enterprise pipeline...');
                // DEBUG: Print raw data
                console.log('RAW ZOMATO DATA:', JSON.stringify(anonymizedData, null, 2));

                const result = await transformToSellableData(anonymizedData, 'zomato', user.id);

                sellableData = result.sellableRecord;
                processedData = result.rawProcessed;
                behavioralInsights = result.geminiInsights;

                console.log('✅ Enterprise data pipeline complete');
                console.log(`📊 Generated cohort: ${sellableData?.audience_segment?.segment_id || 'unknown'}`);
            } catch (pipelineError) {
                console.error('⚠️ Pipeline error:', pipelineError.message);
                console.error('⚠️ Pipeline stack:', pipelineError.stack);
            }
        }

        // Process GitHub data through developer profile pipeline
        if (dataType === 'github_profile') {
            try {
                const { processGithubData } = await import('./githubPipeline.js');

                console.log('📦 Processing GitHub data through developer pipeline...');
                console.log('RAW GITHUB DATA:', JSON.stringify(anonymizedData, null, 2));

                const result = processGithubData(anonymizedData);

                if (result.success) {
                    sellableData = result.sellableData;
                    processedData = result.data;
                    console.log('✅ GitHub developer pipeline complete');
                    console.log(`📊 Developer tier: ${sellableData?.developer_profile?.tier || 'unknown'}`);
                }
            } catch (pipelineError) {
                console.error('⚠️ GitHub pipeline error:', pipelineError.message);
                console.error('⚠️ Pipeline stack:', pipelineError.stack);
            }
        }

        // Process Netflix data through streaming intelligence pipeline
        if (dataType === 'netflix_watch_history') {
            try {
                const { processNetflixData } = await import('./netflixPipeline.js');

                console.log('📦 Processing Netflix data through streaming pipeline...');
                console.log('RAW NETFLIX DATA:', JSON.stringify(anonymizedData, null, 2));

                const result = await processNetflixData(anonymizedData);

                if (result.success) {
                    sellableData = result.sellableRecord;
                    processedData = result.rawProcessed;
                    console.log('✅ Netflix streaming pipeline complete');
                    console.log(`📊 Binge score: ${sellableData?.viewing_behavior?.binge_score || 'unknown'}`);
                }
            } catch (pipelineError) {
                console.error('⚠️ Netflix pipeline error:', pipelineError.message);
                console.error('⚠️ Pipeline stack:', pipelineError.stack);
            }
        }

        // ========================================
        // COMPUTE DATA SIZE FOR REWARDS
        // ========================================
        // Check processed sellableData first, fall back to raw data
        const orderCount = sellableData?.transaction_data?.summary?.total_orders
            || anonymizedData?.orders?.length
            || 0;
        const githubContributions = sellableData?.activity_metrics?.yearly_contributions
            || parseInt(anonymizedData?.contributionsLastYear || '0', 10);
        const netflixTitles = sellableData?.viewing_summary?.total_titles_watched
            || anonymizedData?.watchHistory?.length
            || 0;

        console.log(`📊 Order count: ${orderCount}, GitHub contributions: ${githubContributions}, Netflix titles: ${netflixTitles}`);

        // Determine if large data (Zomato: >10 orders, GitHub: >50 contributions, Netflix: >20 titles)
        let isLargeData = false;
        if (dataType === 'zomato_order_history' && orderCount > 10) {
            isLargeData = true;
        } else if (dataType === 'github_profile' && githubContributions > 50) {
            isLargeData = true;
        } else if (dataType === 'netflix_watch_history' && netflixTitles > 20) {
            isLargeData = true;
        }

        // Store contribution with sellable data format (points awarded inside)
        const contribution = await dbStorage.addContribution(user.id, {
            anonymizedData: processedData,
            sellableData,
            behavioralInsights,
            dataType,
            reclaimProofId,
            processingMethod: sellableData ? 'enterprise_pipeline' : 'raw',
            isLargeData,  // Pass flag for 10 or 20 points
            walletAddress: user.walletAddress  // Include wallet address in contribution
        });

        const pointsAwarded = isLargeData ? 20 : 10;
        console.log(`💰 ${pointsAwarded} points awarded to user ${user.id} (isLargeData: ${isLargeData})`);

        // Update user stats
        const newTotalPoints = (user.totalPoints || 0) + pointsAwarded;
        jsonStorage.updateUserProfile(user.id, {
            lastContributionDate: new Date().toISOString(),
            totalPoints: newTotalPoints,
            league: newTotalPoints >= 100 ? 'Gold' : newTotalPoints >= 50 ? 'Silver' : 'Bronze'
        });

        // ========================================
        // K-ANONYMITY COMPLIANCE CHECK
        // ========================================
        const cohortId = sellableData?.audience_segment?.segment_id;
        let kAnonymityCompliant = null;
        let cohortSize = 0;

        if (cohortId) {
            cohortSize = await dbStorage.getCohortSize(cohortId);
            const MIN_K = 10; // k-anonymity threshold
            kAnonymityCompliant = cohortSize >= MIN_K;

            console.log(`📊 Cohort ${cohortId}: size=${cohortSize}, k_compliant=${kAnonymityCompliant}`);

            // ========================================
            // INCREMENT COHORT COUNTER (Production)
            // ========================================
            const cohortData = cohortService.incrementCohort(cohortId);
            cohortSize = cohortData.count;
            kAnonymityCompliant = cohortData.k_anonymity_compliant;

            // Update the contribution's sellable data with k-anonymity status in database
            if (sellableData?.metadata?.privacy_compliance) {
                const updatedSellableData = {
                    ...sellableData,
                    metadata: {
                        ...sellableData.metadata,
                        privacy_compliance: {
                            ...sellableData.metadata.privacy_compliance,
                            k_anonymity_compliant: kAnonymityCompliant,
                            cohort_size: cohortSize,
                            aggregation_status: !kAnonymityCompliant ? 'pending_more_contributors' : 'sellable'
                        }
                    }
                };

                // Update based on dataType
                if (dataType === 'zomato_order_history') {
                    await sql`UPDATE zomato_contributions 
                              SET sellable_data = ${JSON.stringify(updatedSellableData)}::jsonb,
                                  updated_at = NOW()
                              WHERE id = ${contribution.id}`;
                } else if (dataType === 'netflix_watch_history') {
                    await sql`UPDATE netflix_contributions 
                              SET sellable_data = ${JSON.stringify(updatedSellableData)}::jsonb,
                                  updated_at = NOW()
                              WHERE id = ${contribution.id}`;
                } else if (dataType === 'github_profile') {
                    await sql`UPDATE github_contributions 
                              SET sellable_data = ${JSON.stringify(updatedSellableData)}::jsonb,
                                  updated_at = NOW()
                              WHERE id = ${contribution.id}`;
                }
            }
        }

        // ========================================
        // LOG CONSENT (Compliance Audit Trail)
        // ========================================
        const consentEntry = consentLedger.logConsent({
            userId: user.id,
            reclaimProofId,
            dataType,
            datasetSource: 'reclaim_protocol',
            geoRegion: sellableData?.geo_data?.city_cluster || 'unknown',
            cohortId,
            contributionId: contribution.id,
            orderCount: sellableData?.transaction_data?.summary?.total_orders || 0,
            dataWindowStart: sellableData?.transaction_data?.summary?.data_window_start,
            dataWindowEnd: sellableData?.transaction_data?.summary?.data_window_end,
            walletAddress: user.walletAddress || walletAddress
        });
        console.log(`📋 Consent logged: ${consentEntry.id}`);

        // Update user activity
        jsonStorage.updateUserActivity(user.id);

        res.json({
            success: true,
            contribution: {
                id: contribution.id,
                pointsAwarded: pointsAwarded,
                isLargeData: isLargeData,
                createdAt: contribution.createdAt,
                cohortId: cohortId || null,
                cohortSize,
                kAnonymityCompliant,
                hasSellableData: !!sellableData
            },
            message: `Contribution received! ${pointsAwarded} points awarded.`
        });
    } catch (error) {
        console.error('Contribute error:', error);
        res.status(500).json({ error: 'Failed to submit contribution' });
    }
});

// Get leaderboard
router.get('/leaderboard', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const timeframe = req.query.timeframe || 'all_time'; // 'all_time' or 'weekly'

        let leaderboard;
        if (timeframe === 'weekly') {
            leaderboard = jsonStorage.getWeeklyLeaderboard(limit);
        } else {
            leaderboard = jsonStorage.getLeaderboard(limit);
        }

        res.json({
            success: true,
            leaderboard,
            timeframe
        });
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// ===================
// ENTERPRISE ENDPOINTS
// ===================

// Get cohort statistics
router.get('/enterprise/cohorts', verifyApiKey, (req, res) => {
    try {
        const stats = cohortService.getCohortStats();
        const allCohorts = cohortService.getAllCohorts();
        const compliantCohorts = cohortService.getCompliantCohorts();

        res.json({
            success: true,
            stats,
            cohorts: allCohorts,
            compliant_cohorts: compliantCohorts,
            k_threshold: cohortService.K_THRESHOLD
        });
    } catch (error) {
        console.error('Cohort stats error:', error);
        res.status(500).json({ error: 'Failed to fetch cohort statistics' });
    }
});

// Get consent ledger for audit
router.get('/enterprise/consent-ledger', verifyApiKey, (req, res) => {
    try {
        const { start_date, end_date } = req.query;

        const stats = consentLedger.getConsentStats();
        const entries = consentLedger.exportForAudit(start_date, end_date);

        res.json({
            success: true,
            stats,
            entries,
            exported_at: new Date().toISOString()
        });
    } catch (error) {
        console.error('Consent ledger error:', error);
        res.status(500).json({ error: 'Failed to fetch consent ledger' });
    }
});

// Get sellable data in enterprise format
router.get('/enterprise/dataset', verifyApiKey, async (req, res) => {
    try {
        const { platform, format = 'json', limit = 1000 } = req.query;

        const contributions = await dbStorage.getContributions();

        // Filter to only contributions with sellable data
        let sellableRecords = contributions
            .filter(c => c.sellableData)
            .map(c => c.sellableData);

        // Filter by platform if specified
        if (platform) {
            sellableRecords = sellableRecords.filter(r =>
                r.data?.transaction_summary?.platform?.includes(platform)
            );
        }

        // Apply limit
        sellableRecords = sellableRecords.slice(0, parseInt(limit));

        // Return in requested format
        if (format === 'jsonl') {
            res.setHeader('Content-Type', 'application/x-ndjson');
            res.setHeader('Content-Disposition',
                `attachment; filename="MYRAD_Dataset_${new Date().toISOString().split('T')[0]}.jsonl"`
            );
            return res.send(sellableRecords.map(r => JSON.stringify(r)).join('\n'));
        }

        res.json({
            success: true,
            dataset_info: {
                total_records: sellableRecords.length,
                platforms: [...new Set(sellableRecords.map(r => r.data?.transaction_summary?.platform))],
                generated_at: new Date().toISOString(),
                format: 'myrad_v1'
            },
            records: sellableRecords
        });
    } catch (error) {
        console.error('Enterprise dataset error:', error);
        res.status(500).json({ error: 'Failed to generate dataset' });
    }
});

// Get anonymized data (legacy endpoint)
router.get('/enterprise/data', verifyApiKey, async (req, res) => {
    try {
        const { limit, offset, dataType } = req.query;

        let data = await dbStorage.getAllAnonymizedData();

        // Filter by data type if specified
        if (dataType) {
            data = data.filter(d => d.dataType === dataType);
        }

        // Pagination
        const start = parseInt(offset) || 0;
        const end = start + (parseInt(limit) || 100);
        const paginatedData = data.slice(start, end);

        res.json({
            success: true,
            data: paginatedData,
            total: data.length,
            offset: start,
            limit: end - start
        });
    } catch (error) {
        console.error('Enterprise data error:', error);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

// Get aggregated insights
router.get('/enterprise/insights', verifyApiKey, async (req, res) => {
    try {
        const allData = await dbStorage.getAllAnonymizedData();
        const users = jsonStorage.getUsers();
        const allPoints = jsonStorage.getPoints();

        const insights = {
            totalContributions: allData.length,
            totalUsers: users.length,
            averagePointsPerUser: users.length > 0
                ? Math.round(allPoints.reduce((sum, p) => sum + p.points, 0) / users.length)
                : 0,
            dataTypeBreakdown: {},
            recentActivity: {
                last24Hours: allData.filter(d =>
                    new Date(d.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
                ).length,
                last7Days: allData.filter(d =>
                    new Date(d.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                ).length
            }
        };

        // Calculate data type breakdown
        allData.forEach(d => {
            insights.dataTypeBreakdown[d.dataType] =
                (insights.dataTypeBreakdown[d.dataType] || 0) + 1;
        });

        res.json({
            success: true,
            insights
        });
    } catch (error) {
        console.error('Enterprise insights error:', error);
        res.status(500).json({ error: 'Failed to fetch insights' });
    }
});

// Generate API key (admin endpoint - for testing/demo)
router.post('/enterprise/keys', (req, res) => {
    try {
        const { name, adminSecret } = req.body;

        // Simple admin auth (replace with proper auth in production)
        if (adminSecret !== process.env.ADMIN_SECRET) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const apiKey = jsonStorage.generateApiKey(name);

        res.json({
            success: true,
            apiKey: {
                id: apiKey.id,
                key: apiKey.key,
                name: apiKey.name,
                createdAt: apiKey.createdAt
            },
            message: 'API key generated successfully. Store it securely - it will not be shown again.'
        });
    } catch (error) {
        console.error('Generate API key error:', error);
        res.status(500).json({ error: 'Failed to generate API key' });
    }
});

// ===================
// CONTACT FORM ENDPOINT
// ===================

// Submit contact form inquiry
router.post('/contact', (req, res) => {
    try {
        const { name, company, email, industry, message } = req.body;

        if (!name || !email || !company) {
            return res.status(400).json({ error: 'Name, company, and email are required' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        const inquiry = {
            id: Date.now().toString(),
            name,
            company,
            email,
            industry: industry || 'Not specified',
            message: message || '',
            createdAt: new Date().toISOString(),
            status: 'new'
        };

        // Store inquiry using jsonStorage pattern
        const fs = require('fs');
        const path = require('path');
        const INQUIRIES_FILE = path.join(__dirname, 'data', 'inquiries.json');

        let inquiries = [];
        if (fs.existsSync(INQUIRIES_FILE)) {
            try {
                inquiries = JSON.parse(fs.readFileSync(INQUIRIES_FILE, 'utf8'));
            } catch (e) {
                inquiries = [];
            }
        }

        inquiries.push(inquiry);
        fs.writeFileSync(INQUIRIES_FILE, JSON.stringify(inquiries, null, 2));

        console.log('📬 New contact inquiry:', { name, company, email, industry });

        res.json({
            success: true,
            message: 'Your inquiry has been received. We will get back to you within 1-2 business days.',
            inquiryId: inquiry.id
        });
    } catch (error) {
        console.error('Contact form error:', error);
        res.status(500).json({ error: 'Failed to submit inquiry' });
    }
});

export default router;

