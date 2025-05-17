require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3001; // Default to 3001 if not specified in .env

// Middleware
app.use(cors({
  origin: true,
  credentials: true
})); // Enable CORS with credentials for all routes
app.use(cookieParser()); // Add cookie parser middleware
app.use(express.json()); // To parse JSON request bodies

// Import routes
const authRoutes = require('./routes/auth');
const tradesRoutes = require('./routes/trades');
const adminRoutes = require('./routes/admin');
const depositsRoutes = require('./routes/deposits');

// Basic route for testing
app.get('/', (req, res) => {
    res.send('Hello from the Mock Trading Platform Backend!');
});

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/trades', tradesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/deposits', depositsRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});