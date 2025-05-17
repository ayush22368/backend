const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');

// Middleware to verify admin JWT token
const verifyAdmin = (req, res, next) => {
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
        if (!decoded.isAdmin) {
            return res.status(403).json({ message: 'Forbidden: Admins only' });
        }
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

// GET /api/admin/deposits - Get all pending deposit requests
router.get('/deposits', verifyAdmin, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT d.id, d.user_id, u.username, u.email, d.amount, d.currency, d.status, d.created_at
             FROM deposits d
             JOIN users u ON d.user_id = u.id
             WHERE d.status = 'pending'
             ORDER BY d.created_at ASC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching pending deposits:', error);
        res.status(500).json({ message: 'Error fetching pending deposits' });
    }
});

// POST /api/admin/deposits/:id/approve - Approve a deposit
router.post('/deposits/:id/approve', verifyAdmin, async (req, res) => {
    const depositId = req.params.id;
    try {
        // Start transaction
        await db.query('BEGIN');
        // Get deposit info
        const depositResult = await db.query('SELECT * FROM deposits WHERE id = $1 AND status = $2 FOR UPDATE', [depositId, 'pending']);
        if (depositResult.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ message: 'Deposit not found or already processed' });
        }
        const deposit = depositResult.rows[0];
        // Update deposit status
        await db.query('UPDATE deposits SET status = $1, approved_at = NOW() WHERE id = $2', ['approved', depositId]);
        // Update user balance
        await db.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [deposit.amount, deposit.user_id]);
        // Commit transaction
        await db.query('COMMIT');
        res.json({ message: 'Deposit approved and balance updated.' });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error approving deposit:', error);
        res.status(500).json({ message: 'Error approving deposit' });
    }
});

module.exports = router; 