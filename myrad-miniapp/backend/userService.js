// backend/userService.js
import { sql } from './dbConfig.js';

/**
 * All-time leaderboard
 */
export async function getAllUsers(limit = 100) {
  const rows = await sql`
    SELECT
      id,
      username,
      email,
      wallet_address AS "walletAddress",
      total_points AS "totalPoints",
      league,
      streak,
      last_contribution_date AS "lastContributionDate"
    FROM users
    WHERE wallet_address IS NOT NULL
    ORDER BY total_points DESC
    LIMIT ${limit}
  `;

  return rows;
}
