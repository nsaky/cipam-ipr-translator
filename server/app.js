// server/app.js
//
// This file creates and configures the Express application.
//
// Think of this file as the "setup" file. It:
//   1. Creates the Express app object
//   2. Applies all global middleware (helmet, cors, body parsers)
//   3. Mounts all route files at their correct URL prefixes
//   4. Adds a global error handler at the very end
//
// It does NOT start the server — that happens in index.js.
// Separating "setup" from "start" makes testing easier.

'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const validateOrigin = require('./middleware/validateOrigin');

const app = express();

// ─────────────────────────────────────────────────────────────
// SECURITY MIDDLEWARE
// These run on every single incoming request, before any route handler.
// ─────────────────────────────────────────────────────────────

// Disable X-Powered-By header to prevent technology fingerprinting
app.disable('x-powered-by');

// helmet() automatically sets a collection of secure HTTP response headers.
// For example, it prevents browsers from sniffing the content type,
// sets X-Frame-Options to block clickjacking, and more.
// We call it with no arguments to use all the safe defaults.
app.use(helmet());

// cors() controls which origins (domains) are allowed to call our API.
// Because Person C's React app runs on a different port (3000),
// the browser would normally block these requests as "cross-origin".
// We allow requests from FRONTEND_URL with credentials (cookies) enabled.
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,                  // REQUIRED for cookies to be sent/received
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─────────────────────────────────────────────────────────────
// REQUEST PARSING MIDDLEWARE
// These parse incoming request data before our route handlers see it.
// Explicit body size limits (1mb) protect against payload exhaustion DoS.
// ─────────────────────────────────────────────────────────────

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// cookie-parser reads the Cookie header on each request and makes the
// cookies available as req.cookies.  We need this to read the JWT token
// that the browser sends back with every request after login.
app.use(cookieParser());

// Server-side Origin and Referer validation for state-changing requests (CSRF mitigation).
// Intercepts POST, PUT, PATCH, DELETE and enforces FRONTEND_URL matching when Origin is present.
app.use(validateOrigin);

// ─────────────────────────────────────────────────────────────
// ROUTES
// Each route file handles a group of related endpoints.
// We will add routes here as we build each stage.
// ─────────────────────────────────────────────────────────────

// Health check — a simple route to confirm the server is running.
// No auth required. Used to test deployment as well.
app.get('/api/health', async (req, res) => {
  // We import pool here (inside the handler) to avoid circular dependency
  // issues during early development. In production this is fine.
  const pool = require('./config/db');
  try {
    await pool.query('SELECT 1'); // A minimal query that proves the DB is alive
    res.status(200).json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected', message: err.message });
  }
});

// Mount authentication routes
app.use('/api/auth', require('./routes/auth.routes'));

// Mount document management routes
app.use('/api/documents', require('./routes/document.routes'));

// Mount translation review and editing routes
app.use('/api/translations', require('./routes/translation.routes'));

// Mount glossary management routes
app.use('/api/glossary', require('./routes/glossary.routes'));

// ─────────────────────────────────────────────────────────────
// 404 HANDLER
// If no route above matched the request, we end up here.
// Always put this AFTER all routes.
// ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─────────────────────────────────────────────────────────────
// GLOBAL ERROR HANDLER
// If any route handler calls next(err) with an error,
// Express skips all normal middleware and comes here.
// The 4-parameter signature (err, req, res, next) is what tells
// Express this is an error handler — do not remove any parameter.
// ─────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Log the full error on the server for debugging.
  console.error('Unhandled error:', err);

  // Send a clean, generic message to the client.
  // We never send raw error stack traces to the browser in production.
  const statusCode = err.status || err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message || 'An unexpected error occurred';

  res.status(statusCode).json({ error: message });
});

module.exports = app;
