const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

dotenv.config();
const app = express();

app.use(express.json());

// 🚨 PRODUCTION + LOCAL CORS - cleaned up (no placeholder)
const allowedOrigins = [
  process.env.FRONTEND_URL,                    // Production Vercel
  'http://localhost:5173',                     // Vite default
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
].filter(Boolean);

console.log('✅ Allowed CORS origins:', allowedOrigins);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) {
      console.log('✅ Request with no origin - allowed');
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      console.log(`✅ CORS allowed for origin: ${origin}`);
      callback(null, true);
    } else {
      console.error(`❌ CORS BLOCKED origin: ${origin}`);
      console.error('Allowed:', allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// ❌ REMOVED: app.options('*', cors());  ← this was causing the crash

app.use(helmet());
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));

const { swaggerUi, swaggerDocument, swaggerOptions } = require('./src/config/swagger');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));

const connectDB = require('./src/config/database');
connectDB();

const seedAdmin = require('./src/utils/seedAdmin');
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

// 🚀 Works on BOTH Render (traditional) and Vercel (serverless)
if (process.env.NODE_ENV !== 'production' || process.env.HOSTING_PLATFORM === 'traditional') {
  app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
}

module.exports = app;