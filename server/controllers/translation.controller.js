// server/controllers/translation.controller.js
//
// Translation Review & Editing Controller
//
// Responsibilities:
// - Review and update individual translation segments
// - Edit reviewer-corrected translation text (final_text)
// - Approve individual translation segments (approved: true)
// - Verify document ownership through segment and document relationships
// - Preserve the original English sentence unmodified in the segments table
// - Ensure editing one translation leaves all other segments and languages intact
// - Enforce parameterized SQL queries and input validation

'use strict';

const pool = require('../config/db');

/**
 * Update an individual translation segment (edit text or toggle approval).
 * Method: PATCH /api/translations/:id
 * Body: { "final_text": "संशोधित पाठ" } OR { "approved": true } OR both
 */
async function updateTranslation(req, res, next) {
  const translationId = parseInt(req.params.id, 10);
  if (isNaN(translationId) || translationId <= 0) {
    return res.status(400).json({ error: 'Invalid translation ID. Must be a positive integer.' });
  }

  const { final_text, approved } = req.body || {};

  // Require at least one field to update
  if (final_text === undefined && approved === undefined) {
    return res.status(400).json({
      error: 'At least one field ("final_text" or "approved") must be provided for update.',
    });
  }

  // Validate final_text if provided
  if (final_text !== undefined) {
    if (typeof final_text !== 'string' || final_text.trim().length === 0) {
      return res.status(400).json({
        error: 'final_text must be a non-empty string.',
      });
    }
  }

  // Validate approved if provided
  if (approved !== undefined) {
    if (typeof approved !== 'boolean') {
      return res.status(400).json({
        error: 'approved must be a boolean (true or false).',
      });
    }
  }

  try {
    // 1. Fetch translation with segment and document ownership details
    const lookupQuery = `
      SELECT t.id, t.segment_id, t.lang, t.machine_text, t.final_text, t.approved,
             s.position, s.source_text,
             d.id AS document_id, d.user_id
      FROM translations t
      JOIN segments s ON s.id = t.segment_id
      JOIN documents d ON d.id = s.document_id
      WHERE t.id = $1
    `;
    const lookupResult = await pool.query(lookupQuery, [translationId]);

    const existing = lookupResult.rows[0];
    if (!existing) {
      return res.status(404).json({
        error: 'Translation record not found.',
      });
    }

    // 2. Ownership verification (must own document or be admin)
    if (existing.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied. You do not have permission to edit translations for this document.',
      });
    }

    // 3. Construct dynamic parameterized update query
    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    if (final_text !== undefined) {
      setClauses.push(`final_text = $${paramIndex++}`);
      params.push(final_text.trim());
    }

    if (approved !== undefined) {
      setClauses.push(`approved = $${paramIndex++}`);
      params.push(approved);
    }

    params.push(translationId);

    const updateQuery = `
      UPDATE translations
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, segment_id, lang, machine_text, final_text, approved
    `;

    const updateResult = await pool.query(updateQuery, params);
    const updated = updateResult.rows[0];

    return res.status(200).json({
      message: 'Translation updated successfully.',
      translation: {
        id: updated.id,
        segment_id: updated.segment_id,
        position: existing.position,
        source_text: existing.source_text, // Original English sentence unchanged
        lang: updated.lang,
        machine_text: updated.machine_text,
        final_text: updated.final_text,
        approved: updated.approved,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Fetch a single translation record with its source segment.
 * Method: GET /api/translations/:id
 */
async function getTranslationById(req, res, next) {
  const translationId = parseInt(req.params.id, 10);
  if (isNaN(translationId) || translationId <= 0) {
    return res.status(400).json({ error: 'Invalid translation ID.' });
  }

  try {
    const query = `
      SELECT t.id, t.segment_id, t.lang, t.machine_text, t.final_text, t.approved,
             s.position, s.source_text,
             d.id AS document_id, d.user_id
      FROM translations t
      JOIN segments s ON s.id = t.segment_id
      JOIN documents d ON d.id = s.document_id
      WHERE t.id = $1
    `;
    const result = await pool.query(query, [translationId]);
    const translation = result.rows[0];

    if (!translation) {
      return res.status(404).json({ error: 'Translation record not found.' });
    }

    if (translation.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied. You do not own this document.',
      });
    }

    return res.status(200).json({
      translation: {
        id: translation.id,
        segment_id: translation.segment_id,
        position: translation.position,
        source_text: translation.source_text,
        lang: translation.lang,
        machine_text: translation.machine_text,
        final_text: translation.final_text,
        approved: translation.approved,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  updateTranslation,
  getTranslationById,
};
