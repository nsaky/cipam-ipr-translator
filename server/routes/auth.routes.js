// server/routes/auth.routes.js
//
// Authentication Routes
// Prefix: /api/auth
//
// Endpoints:
// - POST /api/auth/register    -> Public (creates new user account)
// - POST /api/auth/login       -> Public (rate-limited, issues JWT cookie)
// - POST /api/auth/logout      -> Public/User (clears cookie)
// - GET  /api/auth/me          -> Protected (requires valid JWT cookie)
// - GET  /api/auth/admin-check -> Protected (requires admin role; tests RBAC)

'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');

const authController = require('../controllers/auth.controller');
const requireAuth = require('../middleware/requireAuth');
const { requireAdmin } = require('../middleware/requireRole');
const { validateRegistration, validateLogin } = require('../middleware/validate');

const router = express.Router();

// Rate limiter for login endpoint to mitigate brute-force password guessing
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 10,                  // Maximum 10 failed/successful login requests per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many login attempts from this IP. Please try again after 15 minutes.',
  },
});

// ── Public Routes ───────────────────────────────────────────
router.post('/register', validateRegistration, authController.register);
router.post('/login', loginLimiter, validateLogin, authController.login);
router.post('/logout', authController.logout);

// ── Protected Routes (Requires JWT Cookie) ───────────────────
router.get('/me', requireAuth, authController.me);

// ── Role Authorization Test Route (Requires Admin Role) ──────
router.get('/admin-check', requireAuth, requireAdmin, (req, res) => {
  res.status(200).json({
    message: 'Administrator authorization confirmed.',
    user: req.user,
  });
});

module.exports = router;
