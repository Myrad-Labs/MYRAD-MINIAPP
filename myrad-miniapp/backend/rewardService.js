// Reward Service
// Calculates dynamic rewards based on contribution quality

/**
 * Calculate total points for a contribution
 * Formula: Base (10) + Quality Bonus (20 if high quality)
 * 
 * @param {object} params - Calculation parameters
 * @param {number} params.dataQualityScore - Score from 0-1
 * @param {number} params.orderCount - Number of orders in the contribution
 * @returns {object} - Reward breakdown
 */
export const calculateRewards = ({
    dataQualityScore = 0,
    orderCount = 0
}) => {
    // 1. Base Points (10 pts for any valid data/incremental update)
    const BASE_POINTS = 10;

    // 2. High Quality / Large Data Bonus (+20 pts)
    // Awarded if it's a significant contribution (high quality & substantial history)
    // Total becomes 30 pts
    let qualityBonus = 0;
    const isHighQuality = dataQualityScore >= 0.7;
    const isLargeData = orderCount >= 5;

    if (isHighQuality && isLargeData) {
        qualityBonus = 20;
    }

    const totalPoints = BASE_POINTS + qualityBonus;

    return {
        totalPoints,
        breakdown: {
            base: BASE_POINTS,
            quality: qualityBonus,
            streak: 0 // Streaks removed
        },
        streakUpdate: { streak: 0, isContinued: false } // Deprecated
    };
};

/**
 * Determine user league based on total points
 * (Scaled down for new 10-30 point system)
 * @param {number} totalPoints 
 * @returns {string} - League name
 */
export const calculateLeague = (totalPoints) => {
    if (totalPoints >= 5000) return 'Diamond';   // Was 50k
    if (totalPoints >= 2000) return 'Platinum';  // Was 20k
    if (totalPoints >= 1000) return 'Gold';      // Was 10k
    if (totalPoints >= 200) return 'Silver';     // Was 2k
    return 'Bronze';
};
