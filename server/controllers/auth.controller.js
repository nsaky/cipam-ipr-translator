// server/controllers/auth.controller.js
//
// Authentication Controller
//
// Handles business logic for:
// - User registration (with bcrypt password hashing, 10 rounds)
// - User login (with bcrypt verification and httpOnly JWT cookie generation)
// - Logout (clearing the httpOnly cookie)
// - Current user profile retrieval (GET /api/auth/me)
//
// Security guarantees:
// - Passwords and password hashes are NEVER exposed in API responses.
// - Login failures use a single generic error message to prevent account enumeration.
// - All database access goes through Prisma, which parameterizes every query (no SQL injection).

'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

// Public user fields. password_hash is deliberately excluded.
const PUBLIC_USER = { id: true, name: true, email: true, role: true, created_at: true };

const BCRYPT_SALT_ROUNDS = 10;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Register a new user account.
 * Default role is 'user'.
 */
async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

    if (existing) {
      return res.status(409).json({
        error: 'An account with this email already exists.',
      });
    }

    // Hash the password with bcrypt (10 rounds)
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Insert user with enforced default role 'reviewer'
    const newUser = await prisma.user.create({
      data: { name, email, password_hash: passwordHash, role: 'reviewer' },
      select: PUBLIC_USER,
    });

    return res.status(201).json({
      message: 'Account created successfully.',
      user: newUser,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Authenticate user and issue JWT stored in an httpOnly cookie.
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Retrieve user by email (explicit column selection)
    const user = await prisma.user.findUnique({
      where: { email },
      select: { ...PUBLIC_USER, password_hash: true },
    });

    // Generic error message for security (prevents user enumeration)
    const genericAuthError = 'Invalid email or password.';

    if (!user) {
      return res.status(401).json({ error: genericAuthError });
    }

    // Verify password against stored bcrypt hash
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: genericAuthError });
    }

    if (!process.env.JWT_SECRET) {
      console.error('CRITICAL SECURITY ERROR: JWT_SECRET environment variable is not defined.');
      return res.status(500).json({
        error: 'Authentication service is misconfigured.',
      });
    }

    // Generate JWT token containing only non-sensitive identity fields
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Set JWT in a secure, httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,                               // Prevents client-side JS from reading cookie
      secure: process.env.NODE_ENV === 'production', // Transmit only over HTTPS in production
      sameSite: 'strict',                           // Protects against CSRF
      maxAge: ONE_DAY_MS,                           // 1 day
      path: '/',                                    // Valid across entire API
    });

    return res.status(200).json({
      message: 'Login successful.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Log out user by clearing the JWT httpOnly cookie.
 */
function logout(req, res) {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });

  return res.status(200).json({
    message: 'Logged out successfully.',
  });
}

/**
 * Return profile of currently authenticated user.
 */
async function me(req, res, next) {
  try {
    // req.user was attached by requireAuth middleware
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: PUBLIC_USER,
    });

    if (!user) {
      return res.status(401).json({
        error: 'User account not found.',
      });
    }

    return res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  logout,
  me,
};
