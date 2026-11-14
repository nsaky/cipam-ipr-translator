// server/app.js
//
// Express application configuration
//
// Responsibilities:
// 1. Applies global security headers (helmet) and cross-origin policies (cors)
// 2. Parses body payloads (with 1MB limits) and cookies
// 3. Enforces server-side Origin/Referer CSRF validation
// 4. Mounts API routes with dual-prefix support (/api/* and /*)
// 5. Provides centralized error handling

'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const validateOrigin = require('./middleware/validateOrigin');
const { getAllowedOrigins } = require('./middleware/validateOrigin');

const app = express();

// ─────────────────────────────────────────────────────────────
// SECURITY MIDDLEWARE
// ─────────────────────────────────────────────────────────────

// Disable X-Powered-By header to prevent technology fingerprinting
app.disable('x-powered-by');

// Helmet sets secure HTTP response headers
app.use(helmet());

// CORS configuration supporting frontend dev origins (5173, 3000) and FRONTEND_URL
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests with no origin (curl, mobile, CLI)
      if (!origin) return callback(null, true);
      const allowed = getAllowedOrigins();
      if (allowed.includes(origin)) return callback(null, true);
      return callback(new Error('CORS policy: Untrusted origin blocked.'));
    },
    credentials: true, // REQUIRED for cookies to be sent/received
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// ─────────────────────────────────────────────────────────────
// REQUEST PARSING MIDDLEWARE
// ─────────────────────────────────────────────────────────────

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());

// Server-side Origin/Referer CSRF validation for state-changing requests
app.use(validateOrigin);

// ─────────────────────────────────────────────────────────────
// ROUTES
// Dual prefix support: both /api/* and /* resolve to identical controllers
// ─────────────────────────────────────────────────────────────

const authRoutes = require('./routes/auth.routes');
const documentRoutes = require('./routes/document.routes');
const translationRoutes = require('./routes/translation.routes');
const glossaryRoutes = require('./routes/glossary.routes');

// Health check handler
const healthCheckHandler = async (req, res) => {
  const pool = require('./config/db');
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected', message: err.message });
  }
};

app.get('/api/health', healthCheckHandler);
app.get('/health', healthCheckHandler);

// Mount standard routes with /api prefix
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/translations', translationRoutes);
app.use('/api/glossary', glossaryRoutes);

// Mount direct routes without /api prefix for frontend compatibility
app.use('/auth', authRoutes);
app.use('/documents', documentRoutes);
app.use('/translations', translationRoutes);
app.use('/glossary', glossaryRoutes);

// ─────────────────────────────────────────────────────────────
// 404 HANDLER
// ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─────────────────────────────────────────────────────────────
// GLOBAL ERROR HANDLER
// ─────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Handle CORS origin rejection errors
  if (err.message && err.message.startsWith('CORS policy:')) {
    return res.status(403).json({ error: err.message });
  }

  console.error('Unhandled error:', err);

  const statusCode = err.status || err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message || 'An unexpected error occurred';

  res.status(statusCode).json({ error: message });
});

module.exports = app;
