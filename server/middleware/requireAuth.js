// server/middleware/requireAuth.js
//
// Authentication Middleware
//
// How it works:
// 1. Reads the JWT token stored inside the httpOnly cookie named 'token'
//    (or Bearer Authorization header if provided).
// 2. Verifies the cryptographic signature using process.env.JWT_SECRET.
// 3. Extracts the user's id and role from the token payload.
// 4. Attaches req.user = { id, role } so downstream route handlers know
//    who is making the request.
// 5. If missing, tampered with, or expired, returns a 401 Unauthorized response.

'use strict';

const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  // Check the cookie first (primary for browser/Person C React app)
  let token = req.cookies && req.cookies.token;

  // Fallback: Check the Authorization header (e.g. Bearer <token>) for API clients
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required. Please log in.',
    });
  }

  if (!process.env.JWT_SECRET) {
    console.error('CRITICAL SECURITY ERROR: JWT_SECRET environment variable is not defined.');
    return res.status(500).json({
      error: 'Authentication service is misconfigured.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Ensure required fields exist in token payload
    if (!decoded || !decoded.id || !decoded.role) {
      return res.status(401).json({
        error: 'Invalid authentication token payload.',
      });
    }

    // Attach decoded user identity to request object
    req.user = {
      id: decoded.id,
      role: decoded.role,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Session expired. Please log in again.',
      });
    }

    return res.status(401).json({
      error: 'Invalid authentication token.',
    });
  }
}

module.exports = requireAuth;
