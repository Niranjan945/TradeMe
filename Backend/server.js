const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Load environment variables
dotenv.config();

const app = express();

// ====================== MIDDLEWARES ======================
app.use(express.json());
const cors = require('cors');

// Allow requests from your Vercel frontend (or localhost during development)
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true, // Important if you are passing cookies/tokens
}));

app.use(helmet());
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));

// ====================== SWAGGER API DOCUMENTATION ======================
const { swaggerUi, swaggerDocument, swaggerOptions } = require('./src/config/swagger');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));

// ====================== DATABASE CONNECTION ======================
const connectDB = require('./src/config/database');
connectDB();

// ====================== SEED ADMIN USER ======================
const seedAdmin = require('./src/utils/seedAdmin');
seedAdmin();

// ====================== ROUTES ======================
const authRoutes = require('./src/routes/authRoutes');
const tradeRoutes = require('./src/routes/tradeRoutes');
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/trades', tradeRoutes);

// Root health check
app.get('/', (req, res) => {
  res.json({
    success: true,
    status: 200,
    message: '🚀 CryptoTrade Journal Backend is LIVE!',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API version 1 base route
app.get('/api/v1', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to PrimeTrade Journal API v1',
    endpoints: {
      auth: '/api/v1/auth',
      trades: '/api/v1/trades'
    }
  });
});

// ====================== ERROR HANDLING ======================

// 404 - Route Not Found
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found on this server`,
    error: 'The endpoint you are trying to access does not exist'
  });
});

// Global Error Handler - the hero
app.use((err, req, res, next) => {
  console.error('🔥 ERROR DETAILS:', err);   // You will see this in terminal

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ====================== START SERVER ======================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📍 Test it now: http://localhost:${PORT}`);
  console.log(`📚 API Docs: http://localhost:${PORT}/api-docs`);
});