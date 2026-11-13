// server/routes/document.routes.js
//
// Document Management Routes
// Prefix: /api/documents
//
// Endpoints:
// - POST   /api/documents               -> Upload .docx/.pdf/.png/.jpg; extract text; save segments
// - GET    /api/documents               -> List own documents
// - GET    /api/documents/:id           -> Get one document with its segments
// - DELETE /api/documents/:id           -> Delete document and segments
// - POST   /api/documents/:id/translate -> Translate document segments into target language
// - GET    /api/documents/:id/translations -> View translation segments for a language
//
// All routes require a valid JWT session cookie (requireAuth).

'use strict';

const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { handleDocumentUpload } = require('../middleware/upload');
const documentController = require('../controllers/document.controller');

const router = express.Router();

// Enforce authentication on all document endpoints
router.use(requireAuth);

router.post('/', handleDocumentUpload, documentController.uploadDocument);
router.get('/', documentController.getDocuments);
router.get('/:id', documentController.getDocumentById);
router.delete('/:id', documentController.deleteDocument);

// Translation integration endpoints (Person B integration)
router.post('/:id/translate', documentController.translateDocument);
router.get('/:id/translations', documentController.getDocumentTranslations);

// Export integration endpoint (Person B integration)
router.get('/:id/export', documentController.exportDocument);

module.exports = router;
