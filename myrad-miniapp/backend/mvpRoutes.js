// MVP API Routes for MYRAD
import express from 'express';
import * as jsonStorage from './jsonStorage.js';
import * as cohortService from './cohortService.js';
import * as consentLedger from './consentLedger.js';
import * as rewardService from './rewardService.js';


const router = express.Router();

// Middleware to verify Privy token (stub for now)
const verifyPrivyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization token' });
    }

    // For MVP, we'll extract user info from token (stub)
    // In production, verify with Privy API
    const token = authHeader.split(' ')[1];

    // STUB: For now, decode a simple token format: "privy_userId_email"
    try {
        const parts = token.split('_');
        if (parts[0] !== 'privy' || parts.length < 3) {
            return res.status(401).json({ error: 'Invalid token format' });
        }

        req.user = {
            privyId: parts[1],
            email: parts.slice(2).join('_')
        };
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

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

// Verify Privy token and get/create user
router.post('/auth/verify', verifyPrivyToken, (req, res) => {
    try {
        let user = jsonStorage.getUserByPrivyId(req.user.privyId);

        if (!user) {
            user = jsonStorage.createUser(req.user.privyId, req.user.email);
        } else {
            jsonStorage.updateUserActivity(user.id);
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
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
router.get('/user/profile', verifyPrivyToken, (req, res) => {
    try {
        const user = jsonStorage.getUserByPrivyId(req.user.privyId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const contributions = jsonStorage.getUserContributions(user.id);

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
router.get('/user/contributions', verifyPrivyToken, (req, res) => {
    try {
        const user = jsonStorage.getUserByPrivyId(req.user.privyId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const contributions = jsonStorage.getUserContributions(user.id);

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
            const existingContributions = jsonStorage.getContributionsByUserId(user.id);
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
        const recentContributions = jsonStorage.getContributionsByUserId(user.id)
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

        // Store contribution with sellable data format
        const contribution = jsonStorage.addContribution(user.id, {
            anonymizedData: processedData,
            sellableData,
            behavioralInsights,
            dataType,
            reclaimProofId,
            processingMethod: sellableData ? 'enterprise_pipeline' : 'raw'
        });

        // ========================================
        // COMPUTE REWARDS
        // ========================================
        const dataQualityScore = sellableData?.metadata?.data_quality?.score || 0;
        const orderCount = sellableData?.transaction_data?.summary?.total_orders || 0;
        const githubContributions = sellableData?.activity_metrics?.yearly_contributions || 0;

        // BLOCK CONTRIBUTION IF NO DATA (dataType-specific validation)
        if (dataType === 'zomato_order_history' && orderCount === 0) {
            console.log(`⚠️ Zero orders detected for user ${user.id}. No points awarded.`);
            return res.status(400).json({
                success: false,
                error: 'No orders found',
                message: 'Your order history appears to be empty. We can only award points for verifiable order data.',
                contribution: {
                    id: contribution.id,
                    pointsAwarded: 0,
                    orderCount: 0,
                    createdAt: contribution.createdAt
                }
            });
        }

        // For GitHub, award flat 500 points for valid profile verification
        let rewardResult;
        if (dataType === 'github_profile') {
            rewardResult = {
                totalPoints: 500,
                breakdown: {
                    base: 500,
                    quality: 0,
                    bonus: 0
                }
            };
            console.log(`🐙 GitHub profile verified for user ${user.id}. Awarding 500 points.`);
        } else {
            rewardResult = rewardService.calculateRewards({
                dataQualityScore,
                orderCount
            });
        }

        // Award dynamic points
        jsonStorage.addPoints(user.id, rewardResult.totalPoints, 'data_contribution');

        // Update user stats (only league, no streaks)
        const newTotalPoints = (user.totalPoints || 0) + rewardResult.totalPoints;
        jsonStorage.updateUserProfile(user.id, {
            lastContributionDate: new Date().toISOString(),
            league: rewardService.calculateLeague(newTotalPoints)
        });

        // ========================================
        // K-ANONYMITY COMPLIANCE CHECK
        // ========================================
        const cohortId = sellableData?.audience_segment?.segment_id;
        let kAnonymityCompliant = null;
        let cohortSize = 0;

        if (cohortId) {
            cohortSize = jsonStorage.getCohortSize(cohortId);
            const MIN_K = 10; // k-anonymity threshold
            kAnonymityCompliant = cohortSize >= MIN_K;

            console.log(`📊 Cohort ${cohortId}: size=${cohortSize}, k_compliant=${kAnonymityCompliant}`);

            // ========================================
            // INCREMENT COHORT COUNTER (Production)
            // ========================================
            const cohortData = cohortService.incrementCohort(cohortId);
            cohortSize = cohortData.count;
            kAnonymityCompliant = cohortData.k_anonymity_compliant;

            // Update the contribution's sellable data with k-anonymity status
            if (sellableData?.metadata?.privacy_compliance) {
                const contributions = jsonStorage.getContributions(dataType);
                const idx = contributions.findIndex(c => c.id === contribution.id);
                if (idx !== -1) {
                    contributions[idx].sellableData.metadata.privacy_compliance.k_anonymity_compliant = kAnonymityCompliant;
                    contributions[idx].sellableData.metadata.privacy_compliance.cohort_size = cohortSize;
                    if (!kAnonymityCompliant) {
                        contributions[idx].sellableData.metadata.privacy_compliance.aggregation_status = 'pending_more_contributors';
                    } else {
                        contributions[idx].sellableData.metadata.privacy_compliance.aggregation_status = 'sellable';
                    }
                    jsonStorage.saveContributions(contributions, dataType);
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
                pointsAwarded: rewardResult.totalPoints,
                pointsBreakdown: rewardResult.breakdown,
                createdAt: contribution.createdAt,
                cohortId: cohortId || null,
                cohortSize,
                kAnonymityCompliant,
                dataQualityScore: sellableData?.metadata?.data_quality?.score || null,
                hasSellableData: !!sellableData
            },
            message: 'Contribution received! 500 points awarded.'
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
router.get('/enterprise/dataset', verifyApiKey, (req, res) => {
    try {
        const { platform, format = 'json', limit = 1000 } = req.query;

        const contributions = jsonStorage.getContributions();

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
router.get('/enterprise/data', verifyApiKey, (req, res) => {
    try {
        const { limit, offset, dataType } = req.query;

        let data = jsonStorage.getAllAnonymizedData();

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
router.get('/enterprise/insights', verifyApiKey, (req, res) => {
    try {
        const allData = jsonStorage.getAllAnonymizedData();
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

