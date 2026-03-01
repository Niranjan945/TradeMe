const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

dotenv.config();
const app = express();

app.use(express.json());

// 🚨 PRODUCTION FIX: Dynamic CORS for multiple deployment environments
const allowedOrigins = [
  process.env.FRONTEND_URL,          // Production frontend URL from env
  'https://trade-me.vercel.app',     // ⚠️ REPLACE with your actual Vercel URL
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`❌ CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));



app.use(helmet());
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));

const { swaggerUi, swaggerDocument, swaggerOptions } = require('./src/config/swagger');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));

const connectDB = require('./src/config/database');
connectDB();

const seedAdmin = require('./src/utils/seedAdmin');
// 🚨 PRODUCTION FIX: Prevent seed script timeout from crashing the server
try {
  seedAdmin();
} catch (error) {
  console.error("Seed Admin Error:", error);
}

const authRoutes = require('./src/routes/authRoutes');
const tradeRoutes = require('./src/routes/tradeRoutes');
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/trades', tradeRoutes);

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 CryptoTrade Journal Backend is LIVE!',
    environment: process.env.NODE_ENV || 'development'
  });
});

app.use((req, res, next) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('🔥 ERROR DETAILS:', err);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;

// 🚀 PRODUCTION: Export app for serverless (Vercel) AND start server for traditional hosting (Render/Railway)
if (process.env.NODE_ENV !== 'production' || process.env.HOSTING_PLATFORM === 'traditional') {
  app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
}

module.exports = app; // ✅ Required for Vercel serverless functions
