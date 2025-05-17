const { Pool } = require('pg');
require('dotenv').config(); // Ensures process.env variables are loaded

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
    console.error("Error: DATABASE_URL is not set in the .env file.");
    console.error("Please ensure your backend/.env file contains a valid DATABASE_URL.");
    // process.exit(1); // Optionally exit if DB connection is critical for startup
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // SSL configuration for production environments (like Vercel)
    ssl: {
        rejectUnauthorized: false
    }
});

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
