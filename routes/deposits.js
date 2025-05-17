const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    // Check for token in authorization header
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];
    
    // If no token in header, check for token in cookies
    if (!token && req.cookies && req.cookies.auth_token) {
        token = req.cookies.auth_token;
    }
    
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        
        // Refresh token in cookie to extend session
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds
        });
        
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

// POST /api/deposits - User submits a deposit request
router.post('/', verifyToken, async (req, res) => {
    const { amount, currency } = req.body;
    const userId = req.user.userId;
    if (!amount || !currency) {
        return res.status(400).json({ message: 'Amount and currency are required' });
    }
    try {
        await db.query(
            'INSERT INTO deposits (user_id, amount, currency, status) VALUES ($1, $2, $3, $4)',
            [userId, amount, currency, 'pending']
        );
        res.status(201).json({ message: 'Deposit request submitted and pending admin approval.' });
    } catch (error) {
        console.error('Error submitting deposit request:', error);
        res.status(500).json({ message: 'Error submitting deposit request' });
    }
});

module.exports = router; 