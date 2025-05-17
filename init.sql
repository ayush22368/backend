-- SQL script to initialize the database schema

-- Create the users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,                      -- Auto-incrementing integer ID, primary key
    username VARCHAR(50) UNIQUE NOT NULL,       -- Username, must be unique and not empty
    email VARCHAR(100) UNIQUE NOT NULL,      -- Email, must be unique and not empty
    password_hash VARCHAR(255) NOT NULL,     -- Hashed password, not empty
    balance DECIMAL(15,2) DEFAULT 0.00,      -- User's balance, default to 0
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP -- Timestamp of account creation
);

-- Create trades table
CREATE TABLE IF NOT EXISTS trades (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    type VARCHAR(10) NOT NULL, -- 'buy' or 'sell'
    symbol VARCHAR(20) NOT NULL, -- e.g., 'BTC/USD'
    amount DECIMAL(15,2) NOT NULL,
    price DECIMAL(15,2) NOT NULL,
    total_value DECIMAL(15,2) NOT NULL,
    stop_loss DECIMAL(15,2),    -- Stop loss price level
    take_profit DECIMAL(15,2),  -- Take profit price level
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deposits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    amount NUMERIC(18,2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP WITH TIME ZONE
);

SELECT 'Database schema initialization script created.';
