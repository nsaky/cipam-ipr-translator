// server/controllers/document.controller.js
//
// Document Management Controller
//
// Responsibilities:
// - Uploading documents (.docx, .pdf, .png, .jpg)
// - Routing uploaded files through Person B's extractText service
// - Storing document metadata and extracted sentence segments
// - Listing documents owned by the authenticated user
// - Fetching a single document and its ordered segments
// - Deleting a document (with cascade segment removal and disk cleanup)
// - Enforcing document ownership checks

'use strict';

const fs = require('fs');
const prisma = require('../config/db');
const { getSourceType } = require('../middleware/upload');
const { extractText } = require('../services/extract');
const { translate } = require('../services/translate');
const { exportDocx, exportPdf } = require('../services/export');

const SUPPORTED_LANGUAGES = ['hi', 'mr', 'bn', 'gu', 'ta', 'te'];
const SUPPORTED_FORMATS = ['docx', 'pdf'];
const MIME_TYPES = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
};

/** Load a document's owner info (or null) for existence + ownership checks. */
function findDocumentOwner(documentId) {
  return prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, user_id: true, title: true },
  });
}

/**
 * One row per (segment, translation) in segment order, matching what
 * `segments LEFT JOIN translations` returned: segments without a translation
 * still appear once, with null translation fields and approved = false.
 */
async function segmentTranslationRows(documentId, lang) {
  const segments = await prisma.segment.findMany({
    where: { document_id: documentId },
    orderBy: { position: 'asc' },
    include: {
      translations: {
        where: lang ? { lang } : undefined,
        orderBy: { lang: 'asc' },
      },
    },
  });

  const rows = [];
  for (const s of segments) {
    const translations = s.translations.length > 0 ? s.translations : [null];
    for (const t of translations) {
      rows.push({
        id: t ? t.id : null,
        translation_id: t ? t.id : null,
        segment_id: s.id,
        position: s.position,
        sentence_number: s.position,
        source_text: s.source_text,
        original_text: s.source_text,
        lang: t ? t.lang : null,
        machine_text: t ? t.machine_text : null,
        final_text: t ? t.final_text : null,
        approved: t ? t.approved : false,
      });
    }
  }
  return rows;
}

/**
 * Upload a document, trigger text extraction, and store segments.
 * Method: POST /api/documents
 */
async function uploadDocument(req, res, next) {
  if (!req.file) {
    return res.status(400).json({
      error: 'No file uploaded. Please attach a .docx, .pdf, or image file using field "file".',
    });
  }

  try {
    const userId = req.user.id;
    const originalName = req.file.originalname;
    const title = req.body.title && req.body.title.trim().length > 0
      ? req.body.title.trim()
      : originalName;
    const sourceType = getSourceType(originalName);
    const filePath = req.file.path;

    // 1. Call Person B's extraction service first. OCR can take several seconds,
    //    so it runs outside any database transaction.
    const sentences = await extractText(filePath, sourceType);

    if (!Array.isArray(sentences) || sentences.length === 0) {
      throw new Error('Extraction failed to produce text segments.');
    }

    // 2. Insert the document and all its segments in one atomic write
    //    (if any insert fails, nothing is saved).
    const document = await prisma.document.create({
      data: {
        user_id: userId,
        title,
        source_type: sourceType,
        file_path: filePath,
        segments: {
          create: sentences.map((sentence, i) => ({ position: i + 1, source_text: sentence.trim() })),
        },
      },
      select: { id: true, user_id: true, title: true, source_type: true, created_at: true },
    });

    return res.status(201).json({
      message: 'Document uploaded and extracted successfully.',
      document: {
        id: document.id,
        title: document.title,
        source_type: document.source_type,
        created_at: document.created_at,
        segment_count: sentences.length,
        sentence_count: sentences.length,
      },
      segment_count: sentences.length,
      sentence_count: sentences.length,
    });
  } catch (err) {
    // Clean up uploaded file if extraction or the database write fails
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.error('Failed to remove temp file after rollback:', unlinkErr.message);
      }
    }

    next(err);
  }
}

/**
 * List all documents uploaded by the authenticated user.
 * Method: GET /api/documents
 */
async function getDocuments(req, res, next) {
  try {
    const userId = req.user.id;

    // If admin requests all=true, allow viewing all documents; otherwise show user's own
    const showAll = req.user.role === 'admin' && req.query.all === 'true';

    const docs = await prisma.document.findMany({
      where: showAll ? undefined : { user_id: userId },
      orderBy: { created_at: 'desc' },
      select: {
        id: true, user_id: true, title: true, source_type: true, created_at: true,
        _count: { select: { segments: true } },
      },
    });

    const normalizedDocs = docs.map(({ _count, ...d }) => ({
      ...d,
      segment_count: _count.segments,
      sentence_count: _count.segments,
    }));

    return res.status(200).json({
      documents: normalizedDocs,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get details for a specific document including its ordered sentence segments.
 * Method: GET /api/documents/:id
 */
async function getDocumentById(req, res, next) {
  try {
    const documentId = parseInt(req.params.id, 10);
    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID.' });
    }

    // 1. Fetch document record
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, user_id: true, title: true, source_type: true, created_at: true },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    // 2. Ownership verification (must own document or be admin)
    if (document.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied. You do not own this document.',
      });
    }

    // 3. Fetch all extracted sentence segments in sequential order
    const segments = await prisma.segment.findMany({
      where: { document_id: documentId },
      orderBy: { position: 'asc' },
      select: { id: true, position: true, source_text: true },
    });

    const normalizedSegments = segments.map(s => ({
      id: s.id,
      position: s.position,
      sentence_number: s.position,
      source_text: s.source_text,
      original_text: s.source_text,
    }));

    return res.status(200).json({
      document: {
        id: document.id,
        user_id: document.user_id,
        title: document.title,
        source_type: document.source_type,
        created_at: document.created_at,
        segment_count: normalizedSegments.length,
        sentence_count: normalizedSegments.length,
        segments: normalizedSegments,
        sentences: normalizedSegments,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Delete a document, cascading deletion of its segments, and removing file from disk.
 * Method: DELETE /api/documents/:id
 */
async function deleteDocument(req, res, next) {
  try {
    const documentId = parseInt(req.params.id, 10);
    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID.' });
    }

    // Fetch document to check ownership and retrieve disk file path
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, user_id: true, file_path: true },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    // Ownership check
    if (document.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied. You do not have permission to delete this document.',
      });
    }

    // Delete record from database (segments delete automatically via ON DELETE CASCADE)
    await prisma.document.delete({ where: { id: documentId } });

    // Delete physical file from disk
    if (document.file_path && fs.existsSync(document.file_path)) {
      try {
        fs.unlinkSync(document.file_path);
      } catch (unlinkErr) {
        console.error('Notice: Could not remove disk file during document deletion:', unlinkErr.message);
      }
    }

    return res.status(200).json({
      message: 'Document and its segments deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Trigger translation of a document's extracted segments into a target language.
 * Method: POST /api/documents/:id/translate
 * Body: { lang: 'hi' }
 */
async function translateDocument(req, res, next) {
  const documentId = parseInt(req.params.id, 10);
  if (isNaN(documentId)) {
    return res.status(400).json({ error: 'Invalid document ID.' });
  }

  const { lang } = req.body || {};
  if (!lang || typeof lang !== 'string') {
    return res.status(400).json({
      error: 'Target language code is required in request body (e.g., { "lang": "hi" }).',
    });
  }

  const normalizedLang = lang.trim().toLowerCase();
  if (!SUPPORTED_LANGUAGES.includes(normalizedLang)) {
    return res.status(400).json({
      error: `Unsupported target language code: "${lang}". Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}.`,
    });
  }

  try {
    // 1. Verify document existence and ownership
    const document = await findDocumentOwner(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    if (document.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied. You do not own this document.',
      });
    }

    // 2. Retrieve extracted segments in their sequential order
    const segments = await prisma.segment.findMany({
      where: { document_id: documentId },
      orderBy: { position: 'asc' },
      select: { id: true, position: true, source_text: true },
    });

    if (segments.length === 0) {
      return res.status(400).json({
        error: 'Document has no extracted text segments to translate.',
      });
    }

    // 3. Retrieve official glossary terms for this target language
    const glossary = await prisma.glossaryTerm.findMany({
      where: { lang: normalizedLang },
      select: { en_term: true, approved_term: true },
    });

    // 4. Call Person B's translation service
    const sentences = segments.map((s) => s.source_text);
    let translatedSentences;

    try {
      if (req.headers['x-simulate-failure'] === 'true') {
        throw new Error('External translation service connection timeout (Simulated Failure).');
      }
      translatedSentences = await translate(sentences, normalizedLang, glossary);
    } catch (engineErr) {
      return res.status(502).json({
        error: `Translation engine failed: ${engineErr.message}`,
      });
    }

    if (!Array.isArray(translatedSentences) || translatedSentences.length !== segments.length) {
      return res.status(502).json({
        error: 'Translation engine returned an invalid response structure.',
      });
    }

    // 5. Store translations atomically (all or nothing).
    //    UPSERT: re-translating the same segment + language only replaces machine_text,
    //    so a reviewer's final_text and approval are kept.
    const upserted = await prisma.$transaction(
      segments.map((segment, i) =>
        prisma.translation.upsert({
          where: { segment_id_lang: { segment_id: segment.id, lang: normalizedLang } },
          create: { segment_id: segment.id, lang: normalizedLang, machine_text: translatedSentences[i], approved: false },
          update: { machine_text: translatedSentences[i] },
        })
      )
    );

    const storedTranslations = upserted.map((t, i) => ({
      id: t.id,
      translation_id: t.id,
      segment_id: segments[i].id,
      position: segments[i].position,
      sentence_number: segments[i].position,
      source_text: segments[i].source_text,
      original_text: segments[i].source_text,
      lang: t.lang,
      machine_text: t.machine_text,
      final_text: t.final_text,
      approved: t.approved,
    }));

    return res.status(200).json({
      message: 'Translation completed successfully.',
      document_id: documentId,
      lang: normalizedLang,
      sentence_count: storedTranslations.length,
      translation_count: storedTranslations.length,
      sentences: storedTranslations,
      translations: storedTranslations,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Retrieve translation records for a document (optionally filtered by target language).
 * Method: GET /api/documents/:id/translations?lang=hi
 */
async function getDocumentTranslations(req, res, next) {
  const documentId = parseInt(req.params.id, 10);
  if (isNaN(documentId)) {
    return res.status(400).json({ error: 'Invalid document ID.' });
  }

  const { lang } = req.query;
  let normalizedLang = null;

  if (lang) {
    normalizedLang = lang.trim().toLowerCase();
    if (!SUPPORTED_LANGUAGES.includes(normalizedLang)) {
      return res.status(400).json({
        error: `Unsupported target language code: "${lang}". Supported: ${SUPPORTED_LANGUAGES.join(', ')}.`,
      });
    }
  }

  try {
    // 1. Verify document existence and ownership
    const document = await findDocumentOwner(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    if (document.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied. You do not own this document.',
      });
    }

    // 2. Fetch segments joined with translations
    const rows = await segmentTranslationRows(documentId, normalizedLang);

    return res.status(200).json({
      document_id: documentId,
      lang: normalizedLang || 'all',
      sentence_count: rows.length,
      sentences: rows,
      translations: rows,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Export translated document as DOCX or PDF.
 * Method: GET /api/documents/:id/export?lang=hi&format=docx
 *
 * Query Parameters:
 * - lang: Target language code ('hi', 'mr', 'bn', 'gu', 'ta', 'te')
 * - format: 'docx' or 'pdf'
 *
 * Steps:
 * 1. Authenticate user (enforced by middleware).
 * 2. Validate document ID parameter.
 * 3. Validate format parameter ('docx' or 'pdf').
 * 4. Validate lang parameter (must be one of 6 supported Indic languages).
 * 5. Query document by id to verify existence and ownership.
 * 6. Query segments joined with translations for the given language ordered by position ASC.
 * 7. Validate that document has segments and that translations exist and are complete.
 * 8. Construct rows mapped to Person B's contract:
 *    const rows = segments.map(s => ({ translated: s.final_text || s.machine_text }));
 * 9. Call Person B's exportDocx(rows, lang) or exportPdf(rows, lang).
 * 10. Return the binary buffer with proper MIME type and Content-Disposition headers.
 */
async function exportDocument(req, res, next) {
  try {
    const documentId = parseInt(req.params.id, 10);
    if (isNaN(documentId) || documentId <= 0) {
      return res.status(400).json({ error: 'Invalid document ID.' });
    }

    const { lang, format } = req.query;

    if (!format || typeof format !== 'string') {
      return res.status(400).json({
        error: 'Export format is required in query params (?format=docx or ?format=pdf).',
      });
    }

    const normalizedFormat = format.trim().toLowerCase();
    if (!SUPPORTED_FORMATS.includes(normalizedFormat)) {
      return res.status(400).json({
        error: `Unsupported export format: "${format}". Supported formats: ${SUPPORTED_FORMATS.join(', ')}.`,
      });
    }

    if (!lang || typeof lang !== 'string') {
      return res.status(400).json({
        error: `Target language is required in query params (?lang=hi). Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}.`,
      });
    }

    const normalizedLang = lang.trim().toLowerCase();
    if (!SUPPORTED_LANGUAGES.includes(normalizedLang)) {
      return res.status(400).json({
        error: `Unsupported language code: "${lang}". Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}.`,
      });
    }

    // 1. Verify document existence and ownership
    const document = await findDocumentOwner(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    if (document.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied. You do not have permission to export this document.',
      });
    }

    // 2. Retrieve segments and translations in sequential order
    const rowsFromDb = await segmentTranslationRows(documentId, normalizedLang);

    if (rowsFromDb.length === 0) {
      return res.status(400).json({
        error: 'Document has no text segments to export.',
      });
    }

    // 3. Verify that translations exist and are complete for all segments
    const hasMissingTranslation = rowsFromDb.some(
      (r) => !r.translation_id || (!r.final_text && !r.machine_text)
    );

    if (hasMissingTranslation) {
      return res.status(400).json({
        error: `Translations for language "${normalizedLang}" are incomplete or missing. Please translate the document before exporting.`,
      });
    }

    // 4. Map rows to Person B's contract:
    // Person B expects objects with a 'translated' or 'text' property, or plain strings.
    // Reviewer-approved final_text takes precedence over machine_text.
    const rows = rowsFromDb.map((row) => ({
      translated: row.final_text || row.machine_text,
    }));

    // 5. Call Person B's export service
    let fileBuffer;
    try {
      if (req.headers['x-simulate-failure'] === 'true') {
        throw new Error('Simulated export generation failure');
      }

      if (normalizedFormat === 'docx') {
        fileBuffer = await exportDocx(rows, normalizedLang);
      } else if (normalizedFormat === 'pdf') {
        fileBuffer = await exportPdf(rows, normalizedLang);
      }
    } catch (exportErr) {
      return res.status(502).json({
        error: `Export generation failed: ${exportErr.message}`,
      });
    }

    if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
      return res.status(502).json({
        error: 'Export service returned an empty or invalid file buffer.',
      });
    }

    // 6. Set response headers and send downloadable file
    const safeTitle = (document.title || 'document')
      .replace(/[^a-zA-Z0-9_\u0900-\u0D7F-]/g, '_')
      .replace(/_{2,}/g, '_')
      .slice(0, 50);

    const filename = `${safeTitle}_${normalizedLang}.${normalizedFormat}`;
    const mimeType = MIME_TYPES[normalizedFormat];

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', fileBuffer.length);

    return res.status(200).send(fileBuffer);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadDocument,
  getDocuments,
  getDocumentById,
  deleteDocument,
  translateDocument,
  getDocumentTranslations,
  exportDocument,
};
