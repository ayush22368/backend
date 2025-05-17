const { Pool } = require('pg');
require('dotenv').config(); // Ensures process.env variables are loaded

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
    console.error("Error: DATABASE_URL is not set in the .env file.");
    console.error("Please ensure your backend/.env file contains a valid DATABASE_URL.");
    // process.exit(1); // Optionally exit if DB connection is critical for startup
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // Reverted to use DATABASE_URL
    // SSL configuration for production environments (optional, but recommended)
    // ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// TEMPORARY TEST: Direct object configuration for the Pool - COMMENTED OUT
// const pool = new Pool({
//     user: 'trading_app_user',
//     host: 'localhost',
//     database: 'trading_app_db',
//     password: 'p@ss123', // Using the literal password from your setup
//     port: 5432,
// });

// EXPLICIT CONNECTION TEST (keeping for this test)
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('DATABASE CONNECTION FAILED (explicit test):', err);
    } else {
        console.log('Database connected successfully (explicit test). Result:', res.rows[0]);
    }
});

pool.on('connect', () => {
    console.log('Successfully connected to the PostgreSQL database.');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    // process.exit(-1); // Optionally exit if critical
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool: pool // Export the pool itself if direct access is needed
}; 