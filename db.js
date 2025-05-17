console.log('<<<<< DB.JS - USING AIVEN CA CERT - ' + new Date().toISOString() + ' >>>>>'); // New unique log for this attempt

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config(); // For local .env loading, Vercel uses its own env vars

// Check if DATABASE_URL is set (good practice)
if (!process.env.DATABASE_URL) {
    console.error("CRITICAL Error: DATABASE_URL environment variable is not set.");
    // Consider how your app should behave if this isn't set.
    // For Vercel, this should always be set from its UI.
}

let sslConfig; // We will define this based on whether the CA cert loads

try {
    const caPath = path.join(__dirname, 'aiven-ca.pem'); // Assumes aiven-ca.pem is in the same directory as db.js

    // Check if the CA certificate file exists before trying to read it
    if (fs.existsSync(caPath)) {
        const caCert = fs.readFileSync(caPath).toString();
        sslConfig = {
            rejectUnauthorized: true, // IMPORTANT: Must be true when providing your own CA
            ca: caCert
        };
        console.log("Successfully loaded aiven-ca.pem. SSL configured to use it with rejectUnauthorized: true.");
    } else {
        // This case should ideally not happen if you've added the file
        console.warn("WARNING: aiven-ca.pem not found at expected path:", caPath);
        console.warn("Falling back to less secure SSL (rejectUnauthorized: false) - DB connection might still fail or be insecure.");
        sslConfig = {
            rejectUnauthorized: false // Fallback if CA file is missing
        };
    }
} catch (e) {
    console.error("ERROR reading or processing aiven-ca.pem:", e);
    console.warn("Falling back to less secure SSL (rejectUnauthorized: false) due to CA read/process error.");
    sslConfig = {
        rejectUnauthorized: false // Fallback on error
    };
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // This URL should still end with ?sslmode=require
                                                // but REMOVE &sslaccept=accept_invalid_certs if you added it before
    ssl: sslConfig // Apply the determined SSL configuration
});

// EXPLICIT CONNECTION TEST
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('DATABASE CONNECTION FAILED (explicit test - CA cert method):', err);
    } else {
        console.log('Database connected successfully (explicit test - CA cert method). Result:', res.rows[0]);
    }
});

pool.on('connect', () => {
    console.log('PostgreSQL pool event: client connected (CA cert method).');
});

pool.on('error', (err) => {
    console.error('PostgreSQL pool event: unexpected error on idle client (CA cert method)', err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool: pool
};
