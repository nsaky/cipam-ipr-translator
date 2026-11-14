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
// 6. In production, serves the built React app (client/dist) from the same domain

'use strict';

const fs = require('fs');
const path = require('path');
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

// Behind a hosting proxy (Render), trust its X-Forwarded-* headers so req.ip is the
// real client IP. Without this the login rate limiter treats all users as one IP.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Helmet sets secure HTTP response headers
app.use(helmet());

// ─────────────────────────────────────────────────────────────
// FRONTEND (production only)
// Serving the React build from this server keeps the app on ONE domain, so the
// sameSite=strict login cookie works. Registered before CORS so the app's own
// assets are never subject to origin checks.
// ─────────────────────────────────────────────────────────────
const CLIENT_DIST = path.resolve(__dirname, '../client/dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
  app.use(
    express.static(CLIENT_DIST, {
      index: false,
      setHeaders: (res, filePath) => {
        // Vite puts content-hashed files in /assets, so they can be cached forever
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );

  // Page loads (browser asks for HTML) get the React app, even for paths like
  // /documents or /glossary that also exist as API routes. API calls ask for JSON.
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/') && req.accepts(['json', 'html']) === 'html') {
      res.setHeader('Cache-Control', 'no-cache');
      return res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    }
    next();
  });
}

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
  const prisma = require('./config/db');
  try {
    await prisma.$queryRaw`SELECT 1`;
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
