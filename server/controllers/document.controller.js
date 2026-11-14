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
const pool = require('../config/db');
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

  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const originalName = req.file.originalname;
    const title = req.body.title && req.body.title.trim().length > 0
      ? req.body.title.trim()
      : originalName;
    const sourceType = getSourceType(originalName);
    const filePath = req.file.path;

    await client.query('BEGIN');

    // 1. Insert document record
    const docInsertResult = await client.query(
      `INSERT INTO documents (user_id, title, source_type, file_path)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, title, source_type, created_at`,
      [userId, title, sourceType, filePath]
    );

    const document = docInsertResult.rows[0];

    // 2. Call Person B's extraction service
    const sentences = await extractText(filePath, sourceType);

    if (!Array.isArray(sentences) || sentences.length === 0) {
      throw new Error('Extraction failed to produce text segments.');
    }

    // 3. Insert each sentence segment in sequential order
    for (let i = 0; i < sentences.length; i++) {
      const position = i + 1;
      const sentence = sentences[i].trim();

      await client.query(
        `INSERT INTO segments (document_id, position, source_text)
         VALUES ($1, $2, $3)`,
        [document.id, position, sentence]
      );
    }

    await client.query('COMMIT');

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
    await client.query('ROLLBACK');

    // Clean up uploaded file if database transaction fails
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.error('Failed to remove temp file after rollback:', unlinkErr.message);
      }
    }

    next(err);
  } finally {
    client.release();
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
    let query = `
      SELECT d.id, d.user_id, d.title, d.source_type, d.created_at,
             COUNT(s.id)::int AS segment_count
      FROM documents d
      LEFT JOIN segments s ON s.document_id = d.id
      WHERE d.user_id = $1
      GROUP BY d.id
      ORDER BY d.created_at DESC
    `;
    const params = [userId];

    if (req.user.role === 'admin' && req.query.all === 'true') {
      query = `
        SELECT d.id, d.user_id, d.title, d.source_type, d.created_at,
               COUNT(s.id)::int AS segment_count
        FROM documents d
        LEFT JOIN segments s ON s.document_id = d.id
        GROUP BY d.id
        ORDER BY d.created_at DESC
      `;
      params.pop();
    }

    const result = await pool.query(query, params);

    const normalizedDocs = result.rows.map(d => ({
      ...d,
      sentence_count: d.segment_count,
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
    const docResult = await pool.query(
      `SELECT id, user_id, title, source_type, created_at
       FROM documents
       WHERE id = $1`,
      [documentId]
    );

    const document = docResult.rows[0];

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
    const segmentsResult = await pool.query(
      `SELECT id, position, source_text
       FROM segments
       WHERE document_id = $1
       ORDER BY position ASC`,
      [documentId]
    );

    const normalizedSegments = segmentsResult.rows.map(s => ({
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
    const docResult = await pool.query(
      `SELECT id, user_id, file_path
       FROM documents
       WHERE id = $1`,
      [documentId]
    );

    const document = docResult.rows[0];

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
    await pool.query('DELETE FROM documents WHERE id = $1', [documentId]);

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
    const docResult = await pool.query(
      `SELECT id, user_id, title FROM documents WHERE id = $1`,
      [documentId]
    );

    const document = docResult.rows[0];
    if (!document) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    if (document.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied. You do not own this document.',
      });
    }

    // 2. Retrieve extracted segments in their sequential order
    const segmentsResult = await pool.query(
      `SELECT id, position, source_text
       FROM segments
       WHERE document_id = $1
       ORDER BY position ASC`,
      [documentId]
    );

    const segments = segmentsResult.rows;
    if (segments.length === 0) {
      return res.status(400).json({
        error: 'Document has no extracted text segments to translate.',
      });
    }

    // 3. Retrieve official glossary terms for this target language
    const glossaryResult = await pool.query(
      `SELECT en_term, approved_term
       FROM glossary_terms
       WHERE lang = $1`,
      [normalizedLang]
    );
    const glossary = glossaryResult.rows;

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

    // 5. Store translations atomically using database transaction
    const client = await pool.connect();
    const storedTranslations = [];

    try {
      await client.query('BEGIN');

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const machineText = translatedSentences[i];

        // UPSERT: If re-translating same segment + language, update machine_text safely
        const insertRes = await client.query(
          `INSERT INTO translations (segment_id, lang, machine_text, approved)
           VALUES ($1, $2, $3, false)
           ON CONFLICT (segment_id, lang)
           DO UPDATE SET machine_text = EXCLUDED.machine_text
           RETURNING id, segment_id, lang, machine_text, final_text, approved`,
          [segment.id, normalizedLang, machineText]
        );

        storedTranslations.push({
          id: insertRes.rows[0].id,
          translation_id: insertRes.rows[0].id,
          segment_id: segment.id,
          position: segment.position,
          sentence_number: segment.position,
          source_text: segment.source_text,
          original_text: segment.source_text,
          lang: insertRes.rows[0].lang,
          machine_text: insertRes.rows[0].machine_text,
          final_text: insertRes.rows[0].final_text,
          approved: insertRes.rows[0].approved,
        });
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

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
    const docResult = await pool.query(
      `SELECT id, user_id, title FROM documents WHERE id = $1`,
      [documentId]
    );

    const document = docResult.rows[0];
    if (!document) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    if (document.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied. You do not own this document.',
      });
    }

    // 2. Fetch segments joined with translations
    let query;
    let params;

    if (normalizedLang) {
      query = `
        SELECT
          t.id,
          t.id AS translation_id,
          s.id AS segment_id,
          s.position,
          s.position AS sentence_number,
          s.source_text,
          s.source_text AS original_text,
          t.lang,
          t.machine_text,
          t.final_text,
          COALESCE(t.approved, false) AS approved
        FROM segments s
        LEFT JOIN translations t ON t.segment_id = s.id AND t.lang = $2
        WHERE s.document_id = $1
        ORDER BY s.position ASC
      `;
      params = [documentId, normalizedLang];
    } else {
      query = `
        SELECT
          t.id,
          t.id AS translation_id,
          s.id AS segment_id,
          s.position,
          s.position AS sentence_number,
          s.source_text,
          s.source_text AS original_text,
          t.lang,
          t.machine_text,
          t.final_text,
          COALESCE(t.approved, false) AS approved
        FROM segments s
        LEFT JOIN translations t ON t.segment_id = s.id
        WHERE s.document_id = $1
        ORDER BY s.position ASC, t.lang ASC
      `;
      params = [documentId];
    }

    const result = await pool.query(query, params);

    return res.status(200).json({
      document_id: documentId,
      lang: normalizedLang || 'all',
      sentence_count: result.rows.length,
      sentences: result.rows,
      translations: result.rows,
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
    const docResult = await pool.query(
      `SELECT id, user_id, title FROM documents WHERE id = $1`,
      [documentId]
    );

    const document = docResult.rows[0];
    if (!document) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    if (document.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied. You do not have permission to export this document.',
      });
    }

    // 2. Retrieve segments and translations in sequential order
    const segmentsResult = await pool.query(
      `SELECT
         s.id AS segment_id,
         s.position,
         s.source_text,
         t.id AS translation_id,
         t.lang,
         t.machine_text,
         t.final_text,
         t.approved
       FROM segments s
       LEFT JOIN translations t
         ON t.segment_id = s.id
         AND t.lang = $2
       WHERE s.document_id = $1
       ORDER BY s.position ASC`,
      [documentId, normalizedLang]
    );

    const rowsFromDb = segmentsResult.rows;

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
