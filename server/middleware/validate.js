// server/middleware/validate.js
//
// Validation helper middleware for authentication and user input.
// Ensures that incoming requests have the required structure and data types
// before reaching the controller.
//
// Beginner-friendly concept:
// Validating early prevents SQL errors, garbage data, and confusing crashes.

'use strict';

/**
 * Validates registration request body.
 * Expects: name (>=2 chars), email (valid format), password (>=8 chars).
 */
function validateRegistration(req, res, next) {
  const { name, email, password } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({
      error: 'Name is required and must be at least 2 characters long.',
    });
  }

  if (!email || typeof email !== 'string') {
    return res.status(400).json({
      error: 'A valid email address is required.',
    });
  }

  const trimmedEmail = email.trim().toLowerCase();
  // Standard RFC-compliant email regular expression
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return res.status(400).json({
      error: 'Please provide a valid email format (e.g., user@example.com).',
    });
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({
      error: 'Password is required and must be at least 8 characters long.',
    });
  }

  // Attach sanitized fields back to body
  req.body.name = name.trim();
  req.body.email = trimmedEmail;
  req.body.password = password;

  next();
}

/**
 * Validates login request body.
 * Expects: email and password.
 */
function validateLogin(req, res, next) {
  const { email, password } = req.body || {};

  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({
      error: 'Email and password are required.',
    });
  }

  req.body.email = email.trim().toLowerCase();
  req.body.password = password;

  next();
}

module.exports = {
  validateRegistration,
  validateLogin,
};
