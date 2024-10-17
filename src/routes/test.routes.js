const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authenticate = require('../middleware/auth.middleware');
const isAdmin = require('../middleware/isAdmin.middleware');
const db = require('../config/db.config');

// Get all tests with optional filtering by difficulty and domain
router.get('/', async (req, res) => {
    try {
        const { difficulty, domain } = req.query;

        // Base query to fetch all tests
        let query = 'SELECT * FROM tests WHERE 1=1';
        const queryParams = [];

        if (difficulty) {
            query += ' AND difficulty = ?';
            queryParams.push(difficulty);
        }
        if (domain) {
            query += ' AND domain = ?';
            queryParams.push(domain);
        }

        const [tests] = await db.query(query, queryParams);
        res.status(200).json(tests);
    } catch (error) {
        console.error('Error fetching tests:', error);
        res.status(500).json({ error: 'Failed to fetch tests' });
    }
});

// Get a specific test by ID with its questions
router.get('/:id', async (req, res) => {
    try {
        const testId = req.params.id;

        // Fetch the test details
        const [test] = await db.query('SELECT * FROM tests WHERE id = ?', [testId]);

        if (test.length === 0) {
            return res.status(404).json({ error: 'Test not found' });
        }

        // Fetch questions related to the test
        const [questions] = await db.query('SELECT * FROM questions WHERE test_id = ?', [testId]);

        // Fetch options for each question
        const questionsWithOptions = await Promise.all(
            questions.map(async (question) => {
                const [options] = await db.query('SELECT * FROM options WHERE question_id = ?', [question.id]);
                return {
                    ...question,
                    options, // Attach options to each question
                };
            })
        );

        // Respond with test details and questions with options
        res.status(200).json({ ...test[0], questions: questionsWithOptions });
    } catch (error) {
        console.error('Error fetching test:', error);
        res.status(500).json({ error: 'Failed to fetch test' });
    }
});


//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Create a new test (Admin-only)
router.post(
    '/',
    authenticate,
    isAdmin,
    [
        body('title').notEmpty().withMessage('Title is required'),
        body('duration').isNumeric().withMessage('Duration must be a number'),
        body('difficulty').isIn(['easy', 'medium', 'hard']).withMessage('Invalid difficulty level'),
        body('domain').isIn(['aptitude', 'c++', 'networking', 'data structures', 'python']).withMessage('Invalid domain'),
        body('questions').isArray().withMessage('Questions must be an array'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { title, duration, difficulty, domain, questions } = req.body;

        try {
            // Insert the test into the database
            const [result] = await db.query(
                `INSERT INTO tests (title, duration, difficulty, domain, created_by) VALUES (?, ?, ?, ?, ?)`,
                [title, duration, difficulty, domain, req.user.userId]
            );

            const testId = result.insertId;

            // Insert questions into the database
            const questionPromises = questions.map(async (q) => {
                const [questionResult] = await db.query(
                    `INSERT INTO questions (test_id, question, correct_option, explanation) VALUES (?, ?, ?, ?)`,
                    [testId, q.question, q.correctOption, q.explanation || null]
                );

                const questionId = questionResult.insertId;

                // Insert options for the question
                if (q.options && Array.isArray(q.options)) {
                    const optionPromises = q.options.map(option => {
                        return db.query(
                            `INSERT INTO options (question_id, option_text) VALUES (?, ?)`,
                            [questionId, option]
                        );
                    });

                    // Await all option insertions
                    await Promise.all(optionPromises);
                }
            });

            await Promise.all(questionPromises);

            res.status(201).json({ message: 'Test created successfully', testId });
        } catch (error) {
            console.error('Error creating test:', error);
            res.status(500).json({ error: 'Failed to create test' });
        }
    }
);


router.put('/:id', authenticate, isAdmin, async (req, res) => {
    const testId = req.params.id;
    const { title, duration, difficulty, domain } = req.body;

    try {
        const [result] = await db.query(
            `UPDATE tests SET title = ?, duration = ?, difficulty = ?, domain = ? WHERE id = ?`,
            [title, duration, difficulty, domain, testId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Test not found' });
        }

        res.status(200).json({ message: 'Test updated successfully' });
    } catch (error) {
        console.error('Error updating test:', error);
        res.status(500).json({ error: 'Failed to update test' });
    }
});

router.delete('/:id', authenticate, isAdmin, async (req, res) => {
    const testId = req.params.id;

    try {
        const [result] = await db.query('DELETE FROM tests WHERE id = ?', [testId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Test not found' });
        }

        res.status(200).json({ message: 'Test deleted successfully' });
    } catch (error) {
        console.error('Error deleting test:', error);
        res.status(500).json({ error: 'Failed to delete test' });
    }
});

module.exports = router;
