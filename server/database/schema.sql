-- ============================================================
-- CIPAM IPR Translator — PostgreSQL Database Schema
-- File: server/database/schema.sql
-- Author: Person A
--
-- HOW TO RUN:
--   psql -U mekavikas -d cipam_ipr_db -f server/database/schema.sql
--
-- This script is SAFE TO RUN MULTIPLE TIMES.
-- It uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS,
-- so running it again on an existing database does nothing harmful.
--
-- All five tables are created inside a single transaction.
-- If anything fails, nothing is committed — the database stays clean.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- TABLE 1: users
--
-- Stores every person who has an account in the system.
-- The password_hash column holds a bcrypt hash — the plain-text
-- password is NEVER stored anywhere.
-- The role column is locked to exactly 'admin' or 'user' by a CHECK.
-- The email column has a UNIQUE constraint so no two accounts
-- can share the same email address.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL        PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(255)  NOT NULL,
  password_hash TEXT          NOT NULL,
  role          VARCHAR(10)   NOT NULL DEFAULT 'user',
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Unique constraint: no two users may have the same email
  CONSTRAINT users_email_unique UNIQUE (email),

  -- Check constraint: role must be exactly 'admin' or 'user'
  CONSTRAINT users_role_check   CHECK  (role IN ('admin', 'user'))
);

-- ────────────────────────────────────────────────────────────
-- TABLE 2: documents
--
-- Tracks every file uploaded by a user.
-- user_id is a foreign key back to the users table, recording
-- which user owns each document.
--
-- ON DELETE RESTRICT on user_id means PostgreSQL will REFUSE to
-- delete a user if they still have documents. This protects
-- against accidental data loss.
--
-- source_type is locked to 'docx', 'pdf', or 'image' — the three
-- file types the system accepts.  Person B uses this value to
-- decide which extractor to call.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id          SERIAL        PRIMARY KEY,
  user_id     INTEGER       NOT NULL
                REFERENCES users(id)
                ON DELETE RESTRICT,   -- Prevent deleting a user who has documents
  title       VARCHAR(255)  NOT NULL,
  source_type VARCHAR(10)   NOT NULL,
  file_path   VARCHAR(500)  NOT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- source_type must be one of the three accepted file types
  CONSTRAINT documents_source_type_check
    CHECK (source_type IN ('docx', 'pdf', 'image'))
);

-- Index: speeds up queries that say "give me all documents for user X"
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);


-- ────────────────────────────────────────────────────────────
-- TABLE 3: segments
--
-- Each document is split into individual sentences by Person B's
-- extraction service.  Every sentence becomes one row here.
--
-- position records the ORDER of the sentence inside the document
-- (1, 2, 3 …) so we can reassemble the document in the correct order.
--
-- ON DELETE CASCADE on document_id means: when a document is deleted,
-- ALL its segments are automatically deleted too. This is correct
-- because segments cannot exist without their parent document.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS segments (
  id          SERIAL   PRIMARY KEY,
  document_id INTEGER  NOT NULL
                REFERENCES documents(id)
                ON DELETE CASCADE,   -- Delete segments when document is deleted
  position    INTEGER  NOT NULL,
  source_text TEXT     NOT NULL
);

-- Index: speeds up queries that say "give me all segments for document X"
CREATE INDEX IF NOT EXISTS idx_segments_document_id ON segments(document_id);


-- ────────────────────────────────────────────────────────────
-- TABLE 4: translations
--
-- For each segment, there can be one translation per target language.
-- The UNIQUE constraint on (segment_id, lang) enforces this — you
-- cannot have two Hindi translations of the same sentence.
--
-- machine_text: the raw output from the translation API (never edited)
-- final_text: the reviewer's corrected version (NULL until reviewed)
-- approved: false by default; set to true when a reviewer approves it
--
-- ON DELETE CASCADE means: when a segment is deleted, all its
-- translations are deleted too.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS translations (
  id           SERIAL      PRIMARY KEY,
  segment_id   INTEGER     NOT NULL
                 REFERENCES segments(id)
                 ON DELETE CASCADE,  -- Delete translations when segment is deleted
  lang         VARCHAR(5)  NOT NULL,
  machine_text TEXT        NOT NULL,
  final_text   TEXT,                 -- NULL until a reviewer edits it
  approved     BOOLEAN     NOT NULL DEFAULT FALSE,

  -- One translation per language per segment — no duplicates
  CONSTRAINT translations_segment_lang_unique
    UNIQUE (segment_id, lang),

  -- lang must be one of the six supported Indian languages
  CONSTRAINT translations_lang_check
    CHECK (lang IN ('hi', 'mr', 'bn', 'gu', 'ta', 'te'))
);

-- Index: speeds up queries that say "give me all translations for segment X"
CREATE INDEX IF NOT EXISTS idx_translations_segment_id ON translations(segment_id);


-- ────────────────────────────────────────────────────────────
-- TABLE 5: glossary_terms
--
-- A shared dictionary of IPR-specific English terms and their
-- approved translations for each language.  This table is
-- INDEPENDENT — it has no foreign key to users or documents.
--
-- Before every translation API call, Person B fetches the glossary
-- rows for the target language and passes them to the translation
-- prompt, so "trademark" always maps to the same approved word.
--
-- The UNIQUE constraint on (lang, en_term) means: for a given
-- language, each English term can have only ONE approved translation.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS glossary_terms (
  id            SERIAL       PRIMARY KEY,
  en_term       VARCHAR(255) NOT NULL,
  lang          VARCHAR(5)   NOT NULL,
  approved_term VARCHAR(255) NOT NULL,

  -- One approved translation per language per English term
  CONSTRAINT glossary_terms_lang_en_term_unique
    UNIQUE (lang, en_term),

  -- lang must be one of the six supported languages
  CONSTRAINT glossary_terms_lang_check
    CHECK (lang IN ('hi', 'mr', 'bn', 'gu', 'ta', 'te'))
);

COMMIT;

-- ────────────────────────────────────────────────────────────
-- Confirm everything was created
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '✅  Schema applied successfully.';
  RAISE NOTICE '    Tables: users, documents, segments, translations, glossary_terms';
END
$$;
