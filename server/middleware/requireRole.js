// server/middleware/requireRole.js
//
// Role-Based Authorization Middleware
//
// How it works:
// Must be used AFTER requireAuth so that req.user is already populated.
// Checks if req.user.role matches the required role.
// If not, immediately stops execution and returns 403 Forbidden.

'use strict';

/**
 * Middleware that restricts route access to administrators only.
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required. Please log in.',
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Access denied. Administrator privileges required.',
    });
  }

  next();
}

/**
 * General role-checking middleware factory.
 * Example usage: requireRole('admin', 'reviewer')
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required. Please log in.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
}

module.exports = {
  requireAdmin,
  requireRole,
};
