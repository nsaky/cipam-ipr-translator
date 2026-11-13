// server/controllers/glossary.controller.js
//
// Glossary Management Controller
//
// Responsibilities:
// - Listing approved IPR glossary terms (accessible to all authenticated users)
// - Adding new glossary entries (single or multi-language batch, restricted to administrators)
// - Updating existing glossary entries (restricted to administrators)
// - Deleting glossary entries by ID (path, query, body) or by term (query, body) (restricted to administrators)
// - Validating supported target languages ('hi', 'mr', 'bn', 'gu', 'ta', 'te')
// - Enforcing uniqueness constraints on (lang, en_term)
// - Using parameterized SQL queries throughout

'use strict';

const pool = require('../config/db');

const SUPPORTED_LANGUAGES = ['hi', 'mr', 'bn', 'gu', 'ta', 'te'];

/**
 * Retrieve glossary terms (optionally filtered by language).
 * Method: GET /api/glossary?lang=hi or GET /glossary
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

    const formattedTerms = result.rows.map(r => ({
      ...r,
      term: r.en_term,
    }));

    // Group terms by en_term for frontend table presentation
    const termMap = new Map();
    for (const r of result.rows) {
      const key = r.en_term.toLowerCase();
      if (!termMap.has(key)) {
        termMap.set(key, {
          id: r.id,
          term: r.en_term,
          en_term: r.en_term,
          translations: {},
        });
      }
      termMap.get(key).translations[r.lang] = r.approved_term;
      termMap.get(key)[r.lang] = r.approved_term;
    }
    const groupedList = Array.from(termMap.values());

    return res.status(200).json({
      count: result.rows.length,
      lang: lang ? lang.trim().toLowerCase() : 'all',
      terms: formattedTerms,
      glossary: groupedList,
      data: groupedList,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Add a new glossary term or batch multilingual term.
 * Method: POST /api/glossary or POST /glossary
 * Access: Admin only
 * Accepts either:
 * 1. Single term: { "en_term": "Patent", "lang": "hi", "approved_term": "पेटेंट" }
 * 2. Multilingual batch: { "term": "Patent", "translations": { "hi": "...", "mr": "..." } }
 */
async function createGlossaryTerm(req, res, next) {
  try {
    const { en_term, term, lang, approved_term, translations, category, definition } = req.body || {};
    const effectiveTerm = (en_term || term || '').trim();

    // 1. Multilingual batch insertion support (Person C frontend pattern)
    if (translations && typeof translations === 'object' && !Array.isArray(translations)) {
      if (!effectiveTerm) {
        return res.status(400).json({
          error: 'English source term ("term" or "en_term") is required.',
        });
      }

      const langKeys = Object.keys(translations).filter(
        k => SUPPORTED_LANGUAGES.includes(k) && typeof translations[k] === 'string' && translations[k].trim().length > 0
      );

      if (langKeys.length === 0) {
        return res.status(400).json({
          error: `translations object must contain at least one valid language code (${SUPPORTED_LANGUAGES.join(', ')}) with non-empty text.`,
        });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const inserted = [];

        for (const lk of langKeys) {
          const approvedVal = translations[lk].trim();

          // Check if entry for (lang, en_term) already exists
          const check = await client.query(
            'SELECT id FROM glossary_terms WHERE lang = $1 AND LOWER(en_term) = LOWER($2)',
            [lk, effectiveTerm]
          );

          if (check.rows.length > 0) {
            const upd = await client.query(
              'UPDATE glossary_terms SET approved_term = $1 WHERE id = $2 RETURNING id, en_term, lang, approved_term',
              [approvedVal, check.rows[0].id]
            );
            inserted.push(upd.rows[0]);
          } else {
            const ins = await client.query(
              'INSERT INTO glossary_terms (en_term, lang, approved_term) VALUES ($1, $2, $3) RETURNING id, en_term, lang, approved_term',
              [effectiveTerm, lk, approvedVal]
            );
            inserted.push(ins.rows[0]);
          }
        }

        await client.query('COMMIT');

        return res.status(201).json({
          message: 'Glossary entry created successfully.',
          term: effectiveTerm,
          translations,
          entries: inserted,
          entry: {
            id: inserted[0]?.id || Date.now(),
            term: effectiveTerm,
            category: category || 'General IPR',
            definition: definition || '',
            translations,
          },
        });
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }
    }

    // 2. Single term insertion support (Person A API pattern)
    if (!effectiveTerm) {
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

    const trimmedEnTerm = effectiveTerm;
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
 * Delete a glossary term by path ID, query ID, body ID, or by term.
 * Method: DELETE /api/glossary/:id OR DELETE /api/glossary (with id/term in query/body)
 * Access: Admin only
 */
async function deleteGlossaryTerm(req, res, next) {
  try {
    const rawId = req.params.id || req.query.id || (req.body && req.body.id);
    const rawTerm = req.query.term || (req.body && (req.body.term || req.body.en_term));

    // Case 1: ID is provided (e.g. DELETE /api/glossary/5 or DELETE /api/glossary?id=5)
    if (rawId !== undefined && rawId !== null && rawId !== '') {
      const termId = parseInt(rawId, 10);
      if (isNaN(termId) || termId <= 0) {
        return res.status(400).json({ error: 'Invalid glossary term ID. Must be a positive integer.' });
      }

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
        id: deleteResult.rows[0].id,
        success: true,
      });
    }

    // Case 2: Term is provided (e.g. DELETE /api/glossary?term=Patent)
    if (rawTerm && typeof rawTerm === 'string' && rawTerm.trim().length > 0) {
      const trimmedTerm = rawTerm.trim();
      const deleteResult = await pool.query(
        `DELETE FROM glossary_terms
         WHERE LOWER(en_term) = LOWER($1)
         RETURNING id, en_term, lang, approved_term`,
        [trimmedTerm]
      );

      if (deleteResult.rows.length === 0) {
        return res.status(404).json({
          error: `Glossary entry for term "${trimmedTerm}" not found.`,
        });
      }

      return res.status(200).json({
        message: `Deleted ${deleteResult.rows.length} glossary entry/entries for "${trimmedTerm}".`,
        deleted_count: deleteResult.rows.length,
        terms: deleteResult.rows,
        term: trimmedTerm,
        success: true,
      });
    }

    return res.status(400).json({
      error: 'Glossary deletion requires an "id" (path/query/body) or "term" (query/body).',
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
