// server/middleware/validateOrigin.js
//
// Server-Side Origin & Referer Validation Middleware
//
// Responsibilities:
// - Mitigate Cross-Site Request Forgery (CSRF) and cross-origin state tampering.
// - Intercept state-changing HTTP methods: POST, PUT, PATCH, DELETE.
// - Allow safe/read-only HTTP methods: GET, HEAD, OPTIONS without interference.
// - Validate incoming 'Origin' against configured FRONTEND_URL (default: http://localhost:3000).
// - Reject explicitly untrusted origins with HTTP 403 before any route controller executes.
// - Inspect 'Referer' header if 'Origin' is absent (e.g. standard browser navigations).
// - Allow requests without Origin and Referer (non-browser clients like curl, test runners,
//   CLI tools, and mobile SDKs that do not originate from browser document contexts).

'use strict';

// Safe methods that do not mutate server state
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Normalizes and parses the allowed origins from FRONTEND_URL.
 * Supports comma-separated list of origins or default fallback.
 * Strips trailing slashes to guarantee exact origin matching.
 */
function getAllowedOrigins() {
  const envUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return envUrl
    .split(',')
    .map(url => url.trim().replace(/\/+$/, ''))
    .filter(Boolean);
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

  // 3. Case: Origin header is absent, check Referer if present (e.g. standard form submissions)
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
  // Policy explanation:
  // Legitimate non-browser clients (such as curl, Postman, test suites, and backend workers)
  // do not send Origin or Referer headers because they do not execute in a browser document context.
  // In modern browsers, the W3C Fetch standard and browser security models guarantee that
  // cross-origin state-changing requests ALWAYS attach an Origin header, and browser JavaScript
  // cannot suppress or alter this header. Thus, a request without Origin cannot be a browser CSRF attack.
  // Allowing requests with absent Origin/Referer ensures developer tools and automated tests work
  // seamlessly without weakening browser-based CSRF protection.
  return next();
}

module.exports = validateOrigin;
