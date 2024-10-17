const express = require('express');
const router = express.Router();
const db = require('../config/db.config');
const authenticate = require('../middleware/auth.middleware');

router.get('/profile/:userId', async (req, res) => {
    const userId = parseInt(req.params.userId, 10);

    try {
        // Fetch user details
        const userQuery = 'SELECT id, name, email, rating FROM users WHERE id = ?';
        const [user] = await db.query(userQuery, [userId]);

        if (user.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Fetch test results for the user
        const resultsQuery = `
            SELECT r.test_id, r.score, r.time_taken, r.difficulty, r.domain, r.submitted_at, t.title
            FROM results r
            JOIN tests t ON r.test_id = t.id
            WHERE r.user_id = ? ORDER BY r.submitted_at DESC`;
        const results = await db.query(resultsQuery, [userId]);

        // Calculate rating, percentile, and rank
        const rating = user[0].rating;

        // Calculate Percentile
        const percentileQuery = `
            SELECT COUNT(*) AS count 
            FROM users 
            WHERE rating < ?`;
        const [percentileResult] = await db.query(percentileQuery, [rating]);
        const totalUsersWithLowerRating = percentileResult[0].count;

        // Total number of users in the database
        const totalUsersQuery = 'SELECT COUNT(*) AS total FROM users';
        const [totalUsersResult] = await db.query(totalUsersQuery);
        const totalUsers = totalUsersResult[0].total;

        // Calculate Percentile
        const percentile = totalUsers > 0 ? (totalUsersWithLowerRating / totalUsers) * 100 : 0;

        // Calculate Rank
        const rankQuery = `
            SELECT COUNT(*) AS count 
            FROM users 
            WHERE rating > ?`;
        const [rankResult] = await db.query(rankQuery, [rating]);
        const rank = rankResult[0].count + 1; // Rank is count of users with higher rating + 1 for the user themselves

        // Combine user info and results
        const profileData = {
            user: {
                ...user[0],
                percentile: Math.round(percentile),
                rank: rank
            },
            testHistory: results,
        };

        return res.status(200).json(profileData);
    } catch (error) {
        console.error('Error fetching profile data:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/leaderboard/rank', authenticate, async (req, res) => {
    try {
        const currentUserId = parseInt(req.user.userId, 10);

        // Fetch top 10 users based on rating
        const [topRankers] = await db.query(`
            SELECT id, name, rating
            FROM users
            ORDER BY rating DESC
            LIMIT 10
        `);

        const [userData] = await db.query(`
            SELECT rating
            FROM users
            WHERE id = ?
        `, [currentUserId]);

        // Check if user exists
        if (userData.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const userRating = userData[0].rating;

        const [userRankData] = await db.query(`
            SELECT COUNT(*) AS \`rank\`
            FROM users
            WHERE rating > ?
        `, [userRating]);


        const userRank = userRankData[0].rank + 1; // Rank is the count of users with higher ratings + 1 for the current user

        const formattedTopRankers = topRankers.map((ranker, index) => ({
            rank: index + 1,
            name: ranker.name,
            rating: ranker.rating
        }));

        res.json({
            userRank,
            userRating,
            topRankers: formattedTopRankers
        });
    } catch (error) {
        console.error('Error fetching leaderboard data:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;

