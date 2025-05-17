const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db'); // Our database connection module

const router = express.Router();
const SALT_ROUNDS = 10; // For bcrypt password hashing

// POST /api/auth/register
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    // Basic validation
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Username, email, and password are required.' });
    }

    try {
        // Check if username or email already exists
        // Since DB is not connected, this part will fail or needs to be mocked/conditional
        // For now, we'll assume it might fail and proceed cautiously or add a check for db.pool
        if (db.pool && db.pool.options.connectionString) { // Check if DATABASE_URL was likely set
            const existingUser = await db.query(
                'SELECT * FROM users WHERE username = $1 OR email = $2',
                [username, email]
            );
            if (existingUser.rows.length > 0) {
                return res.status(409).json({ message: 'Username or email already exists.' });
            }
        } else {
            console.warn('[Register] DATABASE_URL not set. Skipping duplicate user check. This is not secure for production.');
        }

        // Hash the password
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // Save the user to the database
        // This will also fail if DB is not connected
        if (db.pool && db.pool.options.connectionString) {
            const newUser = await db.query(
                'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
                [username, email, passwordHash]
            );
            res.status(201).json({
                message: 'User registered successfully!',
                user: newUser.rows[0]
            });
        } else {
            console.warn('[Register] DATABASE_URL not set. Skipping user save. User not actually registered.');
            // Simulate successful registration for now if DB is not set, for frontend testing purposes
            res.status(201).json({
                message: 'User registration simulated (DB not connected).',
                user: { id: Date.now(), username, email, created_at: new Date().toISOString() }
            });
        }

    } catch (error) {
        console.error('Registration error:', error);
        // Check if it's a DB connection error specifically (very basic check)
        if (error.message && error.message.includes('database') && !(db.pool && db.pool.options.connectionString)){
             return res.status(503).json({ message: 'Database not configured. Cannot register user.'});
        }
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        // Fetch user by email
        let user = null;
        if (db.pool && db.pool.options.connectionString) {
            const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
            if (result.rows.length === 0) {
                return res.status(401).json({ message: 'Invalid credentials.' });
            }
            user = result.rows[0];

            // Compare submitted password with stored hash
            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid credentials.' });
            }
        } else {
            console.warn('[Login] DATABASE_URL not set. Skipping DB check for login. This is not secure.');
            if (email === "test@example.com" && password === "password123") {
                user = { id: 1, username: "testuser", email: "test@example.com", password_hash: "dummyhash" };
            } else {
                 return res.status(401).json({ message: 'Simulated login failed (DB not connected).' });
            }
        }

        // Set isAdmin true for admin@admin.com, false otherwise
        const isAdmin = user.email === 'admin@admin.com';

        // User is authenticated, generate a JWT token
        const token = jwt.sign(
            { userId: user.id, username: user.username, email: user.email, isAdmin },
            process.env.JWT_SECRET,
            { expiresIn: '30d' } // Increased from 24h to 30 days
        );

        // Set a secure, httpOnly cookie with the token
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds
        });

        res.status(200).json({
            message: 'Login successful!',
            token,
            user: { id: user.id, username: user.username, email: user.email, isAdmin }
        });

    } catch (error) {
        console.error('Login error:', error);
        if (error.message && error.message.includes('database') && !(db.pool && db.pool.options.connectionString)){
             return res.status(503).json({ message: 'Database not configured. Cannot login.'});
        }
        res.status(500).json({ message: 'Server error during login.' });
    }
});

// GET /api/auth/balance - Get current user's balance
router.get('/balance', async (req, res) => {
    try {
        // Get token from header
        const authHeader = req.headers['authorization'];
        let token = authHeader && authHeader.split(' ')[1];
        
        // If no token in header, check for token in cookies
        if (!token && req.cookies && req.cookies.auth_token) {
            token = req.cookies.auth_token;
        }
        
        if (!token) return res.status(401).json({ message: 'No token provided' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;
        
        // Refresh token in cookie to extend session
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds
        });
        
        const result = await db.query('SELECT balance FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
        res.json({ balance: result.rows[0].balance });
    } catch (err) {
        res.status(500).json({ message: 'Error fetching balance' });
    }
});

// POST /api/auth/refresh - Refresh the JWT token
router.post('/refresh', async (req, res) => {
    try {
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

        // Verify existing token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Token expired' });
            }
            return res.status(401).json({ message: 'Invalid token' });
        }

        // Generate a new token with the same payload but extended expiration
        const newToken = jwt.sign(
            { 
                userId: decoded.userId, 
                username: decoded.username, 
                email: decoded.email, 
                isAdmin: decoded.isAdmin 
            },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        // Set the new token in a cookie
        res.cookie('auth_token', newToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds
        });

        res.json({ 
            message: 'Token refreshed successfully', 
            token: newToken 
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ message: 'Server error during token refresh' });
    }
});

// GET /api/auth/check - Check if user is authenticated
router.get('/check', (req, res) => {
    try {
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
        
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Return user info
        res.json({
            authenticated: true,
            user: {
                userId: decoded.userId,
                username: decoded.username,
                email: decoded.email,
                isAdmin: decoded.isAdmin
            }
        });
    } catch (err) {
        // If token is invalid or expired
        res.status(401).json({ 
            authenticated: false,
            message: 'Invalid or expired token'
        });
    }
});

module.exports = router; 