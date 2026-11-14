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
// - All queries go through Prisma (parameterized)

'use strict';

const prisma = require('../config/db');

const SUPPORTED_LANGUAGES = ['hi', 'mr', 'bn', 'gu', 'ta', 'te'];
const TERM_FIELDS = { id: true, en_term: true, lang: true, approved_term: true };

/**
 * Case-insensitive exact match on en_term (same as LOWER(en_term) = LOWER(value)).
 * Prisma implements mode: 'insensitive' with ILIKE, where % and _ are wildcards,
 * so they must be escaped or e.g. a term of "%" would match every row.
 */
function enTermEquals(value) {
  return { equals: value.replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' };
}

// Unique-constraint violation: Prisma (P2002) or raw Postgres (23505).
function isUniqueViolation(err) {
  return err && (err.code === 'P2002' || err.code === '23505');
}

/**
 * Retrieve glossary terms (optionally filtered by language).
 * Method: GET /api/glossary?lang=hi or GET /glossary
 * Access: Authenticated users
 */
async function getGlossaryTerms(req, res, next) {
  try {
    const { lang } = req.query;
    let rows;

    if (lang) {
      const normalizedLang = lang.trim().toLowerCase();
      if (!SUPPORTED_LANGUAGES.includes(normalizedLang)) {
        return res.status(400).json({
          error: `Unsupported language code: "${lang}". Supported: ${SUPPORTED_LANGUAGES.join(', ')}.`,
        });
      }
      rows = await prisma.glossaryTerm.findMany({
        where: { lang: normalizedLang },
        select: TERM_FIELDS,
        orderBy: { en_term: 'asc' },
      });
    } else {
      rows = await prisma.glossaryTerm.findMany({
        select: TERM_FIELDS,
        orderBy: [{ lang: 'asc' }, { en_term: 'asc' }],
      });
    }

    const formattedTerms = rows.map(r => ({
      ...r,
      term: r.en_term,
    }));

    // Group terms by en_term for frontend table presentation
    const termMap = new Map();
    for (const r of rows) {
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
      count: rows.length,
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

      // All languages are written in one transaction: either every entry is saved or none.
      const inserted = await prisma.$transaction(async (tx) => {
        const out = [];
        for (const lk of langKeys) {
          const approvedVal = translations[lk].trim();

          // Update the existing (lang, en_term) entry if there is one, otherwise insert
          const existing = await tx.glossaryTerm.findFirst({
            where: { lang: lk, en_term: enTermEquals(effectiveTerm) },
            select: { id: true },
          });

          out.push(
            existing
              ? await tx.glossaryTerm.update({ where: { id: existing.id }, data: { approved_term: approvedVal }, select: TERM_FIELDS })
              : await tx.glossaryTerm.create({ data: { en_term: effectiveTerm, lang: lk, approved_term: approvedVal }, select: TERM_FIELDS })
          );
        }
        return out;
      });

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
    const duplicate = await prisma.glossaryTerm.findFirst({
      where: { lang: normalizedLang, en_term: enTermEquals(trimmedEnTerm) },
      select: { id: true },
    });

    if (duplicate) {
      return res.status(409).json({
        error: `A glossary entry for term "${trimmedEnTerm}" in language "${normalizedLang}" already exists.`,
      });
    }

    const createdTerm = await prisma.glossaryTerm.create({
      data: { en_term: trimmedEnTerm, lang: normalizedLang, approved_term: trimmedApprovedTerm },
      select: TERM_FIELDS,
    });

    return res.status(201).json({
      message: 'Glossary entry created successfully.',
      term: createdTerm,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
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
    const existing = await prisma.glossaryTerm.findUnique({ where: { id: termId }, select: TERM_FIELDS });
    if (!existing) {
      return res.status(404).json({ error: 'Glossary entry not found.' });
    }

    const newEnTerm = en_term !== undefined ? en_term.trim() : existing.en_term;
    const newLang = normalizedLang !== undefined ? normalizedLang : existing.lang;
    const newApprovedTerm = approved_term !== undefined ? approved_term.trim() : existing.approved_term;

    if (newEnTerm.toLowerCase() !== existing.en_term.toLowerCase() || newLang !== existing.lang) {
      const dup = await prisma.glossaryTerm.findFirst({
        where: { lang: newLang, en_term: enTermEquals(newEnTerm), id: { not: termId } },
        select: { id: true },
      });
      if (dup) {
        return res.status(409).json({
          error: `A glossary entry for term "${newEnTerm}" in language "${newLang}" already exists.`,
        });
      }
    }

    const updatedTerm = await prisma.glossaryTerm.update({
      where: { id: termId },
      data: { en_term: newEnTerm, lang: newLang, approved_term: newApprovedTerm },
      select: TERM_FIELDS,
    });

    return res.status(200).json({
      message: 'Glossary entry updated successfully.',
      term: updatedTerm,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
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

      // deleteMany doesn't throw when nothing matches, so we can return a clean 404
      const [deletedTerm] = await prisma.$transaction([
        prisma.glossaryTerm.findUnique({ where: { id: termId }, select: TERM_FIELDS }),
        prisma.glossaryTerm.deleteMany({ where: { id: termId } }),
      ]);

      if (!deletedTerm) {
        return res.status(404).json({ error: 'Glossary entry not found.' });
      }

      return res.status(200).json({
        message: 'Glossary entry deleted successfully.',
        term: deletedTerm,
        id: deletedTerm.id,
        success: true,
      });
    }

    // Case 2: Term is provided (e.g. DELETE /api/glossary?term=Patent)
    if (rawTerm && typeof rawTerm === 'string' && rawTerm.trim().length > 0) {
      const trimmedTerm = rawTerm.trim();
      const where = { en_term: enTermEquals(trimmedTerm) };
      const [deletedTerms] = await prisma.$transaction([
        prisma.glossaryTerm.findMany({ where, select: TERM_FIELDS, orderBy: { id: 'asc' } }),
        prisma.glossaryTerm.deleteMany({ where }),
      ]);

      if (deletedTerms.length === 0) {
        return res.status(404).json({
          error: `Glossary entry for term "${trimmedTerm}" not found.`,
        });
      }

      return res.status(200).json({
        message: `Deleted ${deletedTerms.length} glossary entry/entries for "${trimmedTerm}".`,
        deleted_count: deletedTerms.length,
        terms: deletedTerms,
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
