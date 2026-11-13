// server/controllers/glossary.controller.js
//
// Glossary Management Controller
//
// Responsibilities:
// - Listing approved IPR glossary terms (accessible to all authenticated users)
// - Adding new glossary entries (restricted to administrators)
// - Updating existing glossary entries (restricted to administrators)
// - Deleting glossary entries (restricted to administrators)
// - Validating supported target languages ('hi', 'mr', 'bn', 'gu', 'ta', 'te')
// - Enforcing uniqueness constraints on (lang, en_term)
// - Using parameterized SQL queries throughout

'use strict';

const pool = require('../config/db');

const SUPPORTED_LANGUAGES = ['hi', 'mr', 'bn', 'gu', 'ta', 'te'];

/**
 * Retrieve glossary terms (optionally filtered by language).
 * Method: GET /api/glossary?lang=hi
 * Access: Authenticated users
 */
async function getGlossaryTerms(req, res, next) {
  try {
    const { lang } = req.query;
    let query;
    let params = [];

    if (lang) {
      const normalizedLang = lang.trim().toLowerCase();
      if (!SUPPORTED_LANGUAGES.includes(normalizedLang)) {
        return res.status(400).json({
          error: `Unsupported language code: "${lang}". Supported: ${SUPPORTED_LANGUAGES.join(', ')}.`,
        });
      }
      query = `
        SELECT id, en_term, lang, approved_term
        FROM glossary_terms
        WHERE lang = $1
        ORDER BY en_term ASC
      `;
      params = [normalizedLang];
    } else {
      query = `
        SELECT id, en_term, lang, approved_term
        FROM glossary_terms
        ORDER BY lang ASC, en_term ASC
      `;
    }

    const result = await pool.query(query, params);

    return res.status(200).json({
      count: result.rows.length,
      lang: lang ? lang.trim().toLowerCase() : 'all',
      terms: result.rows,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Add a new glossary term.
 * Method: POST /api/glossary
 * Access: Admin only
 * Body: { "en_term": "Patent", "lang": "hi", "approved_term": "पेटेंट" }
 */
async function createGlossaryTerm(req, res, next) {
  try {
    const { en_term, lang, approved_term } = req.body || {};

    if (!en_term || typeof en_term !== 'string' || en_term.trim().length === 0) {
      return res.status(400).json({
        error: 'en_term is required and must be a non-empty string.',
      });
    }

    if (!approved_term || typeof approved_term !== 'string' || approved_term.trim().length === 0) {
      return res.status(400).json({
        error: 'approved_term is required and must be a non-empty string.',
      });
    }

    if (!lang || typeof lang !== 'string') {
      return res.status(400).json({
        error: `lang is required. Supported language codes: ${SUPPORTED_LANGUAGES.join(', ')}.`,
      });
    }

    const normalizedLang = lang.trim().toLowerCase();
    if (!SUPPORTED_LANGUAGES.includes(normalizedLang)) {
      return res.status(400).json({
        error: `Unsupported language code: "${lang}". Supported: ${SUPPORTED_LANGUAGES.join(', ')}.`,
      });
    }

    const trimmedEnTerm = en_term.trim();
    const trimmedApprovedTerm = approved_term.trim();

    // Check for existing duplicate (lang, en_term)
    const duplicateCheck = await pool.query(
      `SELECT id FROM glossary_terms WHERE lang = $1 AND LOWER(en_term) = LOWER($2)`,
      [normalizedLang, trimmedEnTerm]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({
        error: `A glossary entry for term "${trimmedEnTerm}" in language "${normalizedLang}" already exists.`,
      });
    }

    const insertResult = await pool.query(
      `INSERT INTO glossary_terms (en_term, lang, approved_term)
       VALUES ($1, $2, $3)
       RETURNING id, en_term, lang, approved_term`,
      [trimmedEnTerm, normalizedLang, trimmedApprovedTerm]
    );

    return res.status(201).json({
      message: 'Glossary entry created successfully.',
      term: insertResult.rows[0],
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'A glossary entry for this term and language already exists.',
      });
    }
    next(err);
  }
}

/**
 * Update an existing glossary term.
 * Method: PUT /api/glossary/:id or PATCH /api/glossary/:id
 * Access: Admin only
 * Body: { "en_term"?: "...", "approved_term"?: "...", "lang"?: "..." }
 */
async function updateGlossaryTerm(req, res, next) {
  const termId = parseInt(req.params.id, 10);
  if (isNaN(termId) || termId <= 0) {
    return res.status(400).json({ error: 'Invalid glossary term ID.' });
  }

  const { en_term, approved_term, lang } = req.body || {};

  if (en_term === undefined && approved_term === undefined && lang === undefined) {
    return res.status(400).json({
      error: 'At least one field ("en_term", "approved_term", or "lang") must be provided for update.',
    });
  }

  if (en_term !== undefined && (typeof en_term !== 'string' || en_term.trim().length === 0)) {
    return res.status(400).json({ error: 'en_term must be a non-empty string.' });
  }

  if (approved_term !== undefined && (typeof approved_term !== 'string' || approved_term.trim().length === 0)) {
    return res.status(400).json({ error: 'approved_term must be a non-empty string.' });
  }

  let normalizedLang;
  if (lang !== undefined) {
    if (typeof lang !== 'string') {
      return res.status(400).json({ error: 'lang must be a string.' });
    }
    normalizedLang = lang.trim().toLowerCase();
    if (!SUPPORTED_LANGUAGES.includes(normalizedLang)) {
      return res.status(400).json({
        error: `Unsupported language code: "${lang}". Supported: ${SUPPORTED_LANGUAGES.join(', ')}.`,
      });
    }
  }

  try {
    // 1. Check if term exists
    const existingResult = await pool.query(
      `SELECT id, en_term, lang, approved_term FROM glossary_terms WHERE id = $1`,
      [termId]
    );

    const existing = existingResult.rows[0];
    if (!existing) {
      return res.status(404).json({ error: 'Glossary entry not found.' });
    }

    const newEnTerm = en_term !== undefined ? en_term.trim() : existing.en_term;
    const newLang = normalizedLang !== undefined ? normalizedLang : existing.lang;
    const newApprovedTerm = approved_term !== undefined ? approved_term.trim() : existing.approved_term;

    // 2. Check for duplicate if en_term or lang changed
    if (newEnTerm.toLowerCase() !== existing.en_term.toLowerCase() || newLang !== existing.lang) {
      const dupCheck = await pool.query(
        `SELECT id FROM glossary_terms WHERE lang = $1 AND LOWER(en_term) = LOWER($2) AND id != $3`,
        [newLang, newEnTerm, termId]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({
          error: `A glossary entry for term "${newEnTerm}" in language "${newLang}" already exists.`,
        });
      }
    }

    // 3. Perform update
    const updateResult = await pool.query(
      `UPDATE glossary_terms
       SET en_term = $1, lang = $2, approved_term = $3
       WHERE id = $4
       RETURNING id, en_term, lang, approved_term`,
      [newEnTerm, newLang, newApprovedTerm, termId]
    );

    return res.status(200).json({
      message: 'Glossary entry updated successfully.',
      term: updateResult.rows[0],
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'A glossary entry for this term and language already exists.',
      });
    }
    next(err);
  }
}

/**
 * Delete a glossary term.
 * Method: DELETE /api/glossary/:id
 * Access: Admin only
 */
async function deleteGlossaryTerm(req, res, next) {
  const termId = parseInt(req.params.id, 10);
  if (isNaN(termId) || termId <= 0) {
    return res.status(400).json({ error: 'Invalid glossary term ID.' });
  }

  try {
    const deleteResult = await pool.query(
      `DELETE FROM glossary_terms
       WHERE id = $1
       RETURNING id, en_term, lang, approved_term`,
      [termId]
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Glossary entry not found.' });
    }

    return res.status(200).json({
      message: 'Glossary entry deleted successfully.',
      term: deleteResult.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getGlossaryTerms,
  createGlossaryTerm,
  updateGlossaryTerm,
  deleteGlossaryTerm,
};
