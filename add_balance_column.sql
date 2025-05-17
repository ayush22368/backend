-- Add balance column to users table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'balance'
    ) THEN
        ALTER TABLE users ADD COLUMN balance DECIMAL(15,2) DEFAULT 0.00;
    END IF;
END $$; 