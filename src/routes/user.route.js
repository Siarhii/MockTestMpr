const express = require('express');
const router = express.Router();
const db = require('../config/db.config');
const authenticate = require('../middleware/auth.middleware');

router.get('/profile', authenticate, async (req, res) => {
    const userId = parseInt(req.user.userId, 10);

    try {
        if (isNaN(userId)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        const userQuery = 'SELECT id, name, email, rating FROM users WHERE id = ?';
        const [user] = await db.query(userQuery, [userId]);

        if (user.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const resultsQuery = `
            SELECT 
                r.id,
                r.test_id,
                t.title,
                r.score,
                (SELECT COUNT(*) FROM questions WHERE test_id = t.id) as total_questions,
                r.time_taken,
                r.difficulty,
                r.domain,
                r.submitted_at
            FROM results r
            JOIN tests t ON r.test_id = t.id
            WHERE r.user_id = ?
            ORDER BY r.submitted_at DESC`;
        const [results] = await db.query(resultsQuery, [userId]);

        // Calculate percentile
        const rating = user[0].rating;
        const [percentileResult] = await db.query(
            'SELECT COUNT(*) AS count FROM users WHERE rating < ?',
            [rating]
        );
        const [totalUsersResult] = await db.query(
            'SELECT COUNT(*) AS total FROM users'
        );

        const totalUsers = totalUsersResult[0].total;
        const totalUsersWithLowerRating = percentileResult[0].count;
        const percentile = totalUsers > 0
            ? (totalUsersWithLowerRating / totalUsers) * 100
            : 0;

        // Calculate rank
        const [rankResult] = await db.query(
            'SELECT COUNT(*) AS count FROM users WHERE rating > ?',
            [rating]
        );
        const rank = rankResult[0].count + 1;

        const profileData = {
            user: {
                ...user[0],
                percentile: parseFloat(percentile.toFixed(1)),
                rank
            },
            testHistory: results.map(result => {
                // Calculate percentage score
                const scorePercentage = result.total_questions > 0
                    ? (result.score / result.total_questions) * 100
                    : 0;

                return {
                    id: result.id,
                    test_id: result.test_id,
                    title: result.title,
                    score: parseFloat(scorePercentage.toFixed(1)),
                    time_taken: parseInt(result.time_taken),
                    difficulty: result.difficulty,
                    domain: result.domain,
                    submitted_at: result.submitted_at.toISOString()
                };
            })
        };

        return res.status(200).json(profileData);
    } catch (error) {
        console.error('Error fetching profile data:', error);
        return res.status(500).json({
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
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

