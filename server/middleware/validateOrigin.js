// server/middleware/validateOrigin.js
//
// Server-Side Origin & Referer Validation Middleware
//
// Responsibilities:
// - Mitigate Cross-Site Request Forgery (CSRF) and cross-origin state tampering.
// - Intercept state-changing HTTP methods: POST, PUT, PATCH, DELETE.
// - Allow safe/read-only HTTP methods: GET, HEAD, OPTIONS without interference.
// - Validate incoming 'Origin' against configured FRONTEND_URL and default frontend dev origins:
//   http://localhost:5173 (Vite) and http://localhost:3000 (React).
// - Reject explicitly untrusted origins with HTTP 403 before any route controller executes.
// - Inspect 'Referer' header if 'Origin' is absent (e.g. standard browser navigations).
// - Reject cookie-authenticated state-changing requests when both Origin and Referer are absent
//   to block CSRF in environments where headers might be suppressed.
// - Permit explicitly supported non-browser Bearer-token authentication without cookie CSRF blocks.
// - Permit public unauthenticated auth routes (login/register).

'use strict';

// Safe methods that do not mutate server state
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Default local development origins
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
];

/**
 * Normalizes and parses the allowed origins from FRONTEND_URL environment variable
 * combined with standard frontend development defaults.
 * Strips trailing slashes to guarantee exact origin matching.
 */
function getAllowedOrigins() {
  const defaults = [...DEFAULT_ALLOWED_ORIGINS];
  const envUrl = process.env.FRONTEND_URL;
  if (!envUrl) return defaults;

  const configured = envUrl
    .split(',')
    .map(url => url.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  return Array.from(new Set([...configured, ...defaults]));
}

/**
 * Express middleware to validate request origin on state-changing operations.
 */
function validateOrigin(req, res, next) {
  // 1. Safe HTTP methods do not change state — allow immediately
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    return next();
  }

  const allowedOrigins = getAllowedOrigins();
  const originHeader = req.headers.origin;
  const refererHeader = req.headers.referer;

  // 2. Case: Origin header is present (standard browser cross-origin requests, fetch/XHR)
  if (originHeader) {
    const normalizedOrigin = originHeader.trim().replace(/\/+$/, '');
    if (allowedOrigins.includes(normalizedOrigin)) {
      return next();
    }
    return res.status(403).json({
      error: 'Access denied: Untrusted or invalid origin.',
    });
  }

  // 3. Case: Origin header is absent, check Referer if present
  if (refererHeader) {
    try {
      const refererUrl = new URL(refererHeader);
      const refererOrigin = refererUrl.origin.trim().replace(/\/+$/, '');
      if (allowedOrigins.includes(refererOrigin)) {
        return next();
      }
      return res.status(403).json({
        error: 'Access denied: Untrusted or invalid referer origin.',
      });
    } catch {
      // Malformed Referer URL
      return res.status(403).json({
        error: 'Access denied: Malformed referer header.',
      });
    }
  }

  // 4. Case: Both Origin and Referer headers are absent
  // Check if request is authenticated via HttpOnly cookie:
  const hasCookieToken = Boolean(req.cookies && req.cookies.token);
  const authHeader = req.headers.authorization;
  const isBearerAuth = Boolean(authHeader && authHeader.startsWith('Bearer '));

  // If request relies on cookie authentication for a state-changing operation,
  // require Origin or Referer to defend against CSRF
  if (hasCookieToken && !isBearerAuth) {
    return res.status(403).json({
      error: 'Access denied: Origin or Referer header required for cookie-authenticated state-changing operations.',
    });
  }

  // Allow Bearer-authenticated CLI/API requests or unauthenticated public state-changing requests
  return next();
}

module.exports = validateOrigin;
module.exports.getAllowedOrigins = getAllowedOrigins;
