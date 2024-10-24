const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth.middleware');
const db = require('../config/db.config');

const DIFFICULTY_MULTIPLIERS = {
    'easy': 1,
    'medium': 1.5,
    'hard': 2
};

const TIME_BONUS_THRESHOLD = 0.7;
const TIME_BONUS_POINTS = 20;
const BASE_POINTS = {
    'easy': 50,
    'medium': 75,
    'hard': 100
};

// Helper function to calculate rating change
const calculateRatingChange = async (score, totalQuestions, difficulty, timeTaken, testDuration) => {
    // Calculate base rating change
    const percentageScore = score / totalQuestions;
    const basePoints = BASE_POINTS[difficulty];
    const difficultyMultiplier = DIFFICULTY_MULTIPLIERS[difficulty];

    // Calculate performance rating
    let ratingChange = Math.round(basePoints * percentageScore * difficultyMultiplier);

    // Add time bonus if completed quickly and accurately
    if (timeTaken <= testDuration * TIME_BONUS_THRESHOLD && percentageScore >= 0.8) {
        ratingChange += TIME_BONUS_POINTS;
    }

    if (percentageScore < 0.3) {
        ratingChange = -Math.abs(ratingChange * 0.5); // Penalty for very poor performance
    } else if (percentageScore < 0.5) {
        ratingChange = -Math.abs(ratingChange * 0.25); // Smaller penalty for below average
    }

    return ratingChange;
};

router.post('/submit', authenticate, async (req, res) => {
    const user_id = parseInt(req.user.userId, 10);
    const { test_id, time_taken, difficulty, domain, user_answers } = req.body;

    if (!test_id || !time_taken || !difficulty || !domain || !user_answers) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {

        const [testDetails] = await db.query(
            'SELECT duration FROM tests WHERE id = ?',
            [test_id]
        );

        const testDuration = testDetails[0].duration;

        // Get questions and calculate score
        const [questions] = await db.query(
            'SELECT id, correct_option FROM questions WHERE test_id = ?',
            [test_id]
        );

        let score = 0;
        questions.forEach((question, index) => {
            if (user_answers[index] === question.correct_option) {
                score++;
            }
        });

        // Calculate rating change
        const ratingChange = await calculateRatingChange(
            score,
            questions.length,
            difficulty,
            time_taken,
            testDuration
        );

        // Save test results
        const resultsQuery = `
            INSERT INTO results (user_id, test_id, score, time_taken, difficulty, domain)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        await db.query(resultsQuery, [user_id, test_id, score, time_taken, difficulty, domain]);

        // Update user rating
        const updateRatingQuery = `
            UPDATE users 
            SET rating = GREATEST(0, LEAST(9999, rating + ?))
            WHERE id = ?
        `;
        await db.query(updateRatingQuery, [ratingChange, user_id]);

        // Get updated user rating
        const [updatedUser] = await db.query(
            'SELECT rating FROM users WHERE id = ?',
            [user_id]
        );

        res.status(201).json({
            message: 'Quiz results saved successfully',
            score,
            ratingChange,
            newRating: updatedUser[0].rating
        });

    } catch (error) {
        console.error('Error saving results:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;