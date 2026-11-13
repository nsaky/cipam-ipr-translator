-- ============================================================
-- Migration: 001_add_reviewer_role.sql
-- Description: Adds 'reviewer' role to users_role_check constraint
--              and sets 'reviewer' as the default role for new users.
-- Author: Person A
-- ============================================================

BEGIN;

-- 1. Safely drop the existing constraint if present
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. Add updated check constraint supporting 'admin', 'reviewer', and 'user'
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('admin', 'reviewer', 'user'));

-- 3. Update the column default for new user registrations
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'reviewer';

COMMIT;

-- ============================================================
-- ROLLBACK SCRIPT:
--   UPDATE users SET role = 'user' WHERE role = 'reviewer';
--   ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
--   ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'user'));
--   ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';
-- ============================================================
