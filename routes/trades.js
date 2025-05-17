const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

// POST /api/trades/buy
router.post('/buy', verifyToken, async (req, res) => {
    const { symbol, amount, price, stopLoss, takeProfit } = req.body;
    const userId = req.user.userId;

    if (!symbol || !amount || !price) {
        return res.status(400).json({ message: 'Symbol, amount, and price are required' });
    }

    try {
        // Calculate total value
        const totalValue = amount * price;

        // Check user's balance
        const userResult = await db.query('SELECT balance FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const userBalance = parseFloat(userResult.rows[0].balance);
        if (userBalance < totalValue) {
            return res.status(400).json({ 
                message: 'Insufficient balance',
                required: totalValue,
                available: userBalance
            });
        }

        // Start transaction
        await db.query('BEGIN');

        // Create trade record
        const tradeResult = await db.query(
            'INSERT INTO trades (user_id, type, symbol, amount, price, total_value, stop_loss, take_profit) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [userId, 'buy', symbol, amount, price, totalValue, stopLoss, takeProfit]
        );

        // Update user's balance
        await db.query(
            'UPDATE users SET balance = balance - $1 WHERE id = $2',
            [totalValue, userId]
        );

        // Commit transaction
        await db.query('COMMIT');

        res.status(201).json({
            message: 'Trade executed successfully',
            trade: tradeResult.rows[0]
        });

    } catch (error) {
        // Rollback transaction on error
        await db.query('ROLLBACK');
        console.error('Trade error:', error);
        res.status(500).json({ message: 'Error executing trade' });
    }
});

// POST /api/trades/sell
router.post('/sell', verifyToken, async (req, res) => {
    const { symbol, amount, price, stopLoss, takeProfit } = req.body;
    const userId = req.user.userId;

    if (!symbol || !amount || !price) {
        return res.status(400).json({ message: 'Symbol, amount, and price are required' });
    }

    try {
        // Calculate total value
        const totalValue = amount * price;

        // Start transaction
        await db.query('BEGIN');

        // Create trade record
        const tradeResult = await db.query(
            'INSERT INTO trades (user_id, type, symbol, amount, price, total_value, stop_loss, take_profit) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [userId, 'sell', symbol, amount, price, totalValue, stopLoss, takeProfit]
        );

        // Update user's balance (add value for sell)
        await db.query(
            'UPDATE users SET balance = balance + $1 WHERE id = $2',
            [totalValue, userId]
        );

        // Commit transaction
        await db.query('COMMIT');

        res.status(201).json({
            message: 'Trade executed successfully',
            trade: tradeResult.rows[0]
        });

    } catch (error) {
        // Rollback transaction on error
        await db.query('ROLLBACK');
        console.error('Trade error:', error);
        res.status(500).json({ message: 'Error executing trade' });
    }
});

// GET /api/trades/positions
router.get('/positions', verifyToken, async (req, res) => {
    const userId = req.user.userId;
    const { status } = req.query; // 'open', 'pending', or 'closed'

    try {
        let query = 'SELECT * FROM trades WHERE user_id = $1';
        const queryParams = [userId];

        if (status) {
            query += ' AND status = $2';
            queryParams.push(status);
        }

        query += ' ORDER BY created_at DESC';

        const result = await db.query(query, queryParams);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching positions:', error);
        res.status(500).json({ message: 'Error fetching positions' });
    }
});

module.exports = router; 