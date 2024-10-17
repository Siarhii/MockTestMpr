const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db.config');
require('dotenv').config();

const router = express.Router();

const COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000
};

router.post(
    '/signup',
    [
        body('name').trim().notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Enter a valid email'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
        body('role').optional().isIn(['user', 'admin']).withMessage('Role must be either "user" or "admin"'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, email, password, role } = req.body;

        try {
            const [existingUser] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
            if (existingUser.length) {
                return res.status(400).json({ message: 'Email is already registered.' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const [result] = await db.query(
                'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                [name, email, hashedPassword, role || 'user']
            );

            res.status(201).json({ message: 'User registered successfully.', userId: result.insertId });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Error registering user.' });
        }
    }
);

router.post(
    '/login',
    [
        body('email').isEmail().withMessage('Enter a valid email'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        try {
            const [user] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
            if (!user.length) {
                return res.status(400).json({ message: 'Invalid email or password.' });
            }

            const validPassword = await bcrypt.compare(password, user[0].password);
            if (!validPassword) {
                return res.status(400).json({ message: 'Invalid email or password.' });
            }

            const token = jwt.sign(
                { userId: user[0].id, role: user[0].role },
                process.env.JWT_SECRET,
                { expiresIn: process.env.AUTH_TIME }
            );

            res.cookie('authToken', token, COOKIE_OPTIONS);

            res.status(200).json({ message: 'Login successful.' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Error logging in.' });
        }
    }
);

module.exports = router;
