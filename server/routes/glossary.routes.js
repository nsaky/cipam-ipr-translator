// server/routes/glossary.routes.js
//
// Glossary Routes
//
// Endpoints:
// - GET    /api/glossary       - List glossary terms (optional ?lang=hi filter) [Authenticated]
// - POST   /api/glossary       - Add a new glossary entry [Admin only]
// - PUT    /api/glossary/:id   - Update an existing glossary entry [Admin only]
// - PATCH  /api/glossary/:id   - Update an existing glossary entry [Admin only]
// - DELETE /api/glossary/:id   - Delete a glossary entry [Admin only]

'use strict';

const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/requireAuth');
const { requireAdmin } = require('../middleware/requireRole');
const {
  getGlossaryTerms,
  createGlossaryTerm,
  updateGlossaryTerm,
  deleteGlossaryTerm,
} = require('../controllers/glossary.controller');

// All glossary endpoints require an authenticated user
router.use(requireAuth);

// Read glossary: accessible by regular users and admins
router.get('/', getGlossaryTerms);

// Admin-only endpoints for managing glossary definitions
router.post('/', requireAdmin, createGlossaryTerm);
router.put('/:id', requireAdmin, updateGlossaryTerm);
router.patch('/:id', requireAdmin, updateGlossaryTerm);
router.delete('/', requireAdmin, deleteGlossaryTerm);
router.delete('/:id', requireAdmin, deleteGlossaryTerm);

module.exports = router;
