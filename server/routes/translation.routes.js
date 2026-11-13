// server/routes/translation.routes.js
//
// Translation Review & Editing Routes
// Prefix: /api/translations
//
// Endpoints:
// - PATCH /api/translations/:id -> Update reviewer edited text (final_text) or approval
// - GET   /api/translations/:id -> Fetch single translation segment with source text
//
// All routes require a valid JWT cookie session (requireAuth).

'use strict';

const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const translationController = require('../controllers/translation.controller');

const router = express.Router();

// Enforce authentication on all translation endpoints
router.use(requireAuth);

router.patch('/:id', translationController.updateTranslation);
router.get('/:id', translationController.getTranslationById);

module.exports = router;
