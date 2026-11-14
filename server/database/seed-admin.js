// server/database/seed-admin.js
//
// PURPOSE:
//   Creates the initial administrator account in the database.
//   This is a one-time setup script you run from the terminal.
//
// WHY A SEPARATE JS FILE AND NOT SQL?
//   SQL cannot run bcrypt — it has no built-in password hashing.
//   We MUST hash the password in Node.js before inserting it.
//   NEVER insert a plain-text password into the database, even
//   as a temporary value.
//
// HOW TO CONFIGURE THE ADMIN CREDENTIALS:
//   Add these three lines to your .env file:
//
//     ADMIN_EMAIL=admin@cipam.gov.in
//     ADMIN_NAME=CIPAM Administrator
//     ADMIN_PASSWORD=choose_a_strong_password_here
//
//   Then run this script once:
//     node server/database/seed-admin.js
//
// SAFETY:
//   - The password is read from the environment — it never appears in this file.
//   - ON CONFLICT DO NOTHING means running this script twice is harmless.
//   - If ADMIN_PASSWORD is not set, the script refuses to run.

'use strict';

// Load .env from the project root (two levels up from this file)
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const bcrypt = require('bcrypt');
// Reuse the existing pool — do not create a new connection
const pool   = require('../config/db');

async function seedAdmin() {
  // ── 1. Read credentials from environment variables ─────────
  const adminEmail    = process.env.ADMIN_EMAIL    || 'admin@cipam.gov.in';
  const adminName     = process.env.ADMIN_NAME     || 'CIPAM Administrator';
  const adminPassword = process.env.ADMIN_PASSWORD;

  // ── 2. Refuse to run without a password ────────────────────
  if (!adminPassword) {
    console.error('');
    console.error('❌  ADMIN_PASSWORD is not set in your .env file.');
    console.error('');
    console.error('    Open .env and add:');
    console.error('      ADMIN_PASSWORD=choose_a_strong_password_here');
    console.error('    Then run this script again.');
    console.error('');
    process.exit(1);
  }

  console.log('');
  console.log('🔐  Hashing admin password with bcrypt (10 rounds)…');

  // ── 3. Hash the password with bcrypt (10 salt rounds) ──────
  // This is what actually gets stored. The plain-text password
  // is only held in memory here and is never written anywhere.
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  // ── 4. Insert the admin user (skip if email already exists) ─
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO NOTHING
     RETURNING id, name, email, role, created_at`,
    [adminName, adminEmail, passwordHash]
  );

  if (result.rows.length > 0) {
    const admin = result.rows[0];
    console.log('✅  Admin account created successfully.');
    console.log('    ID:    ', admin.id);
    console.log('    Name:  ', admin.name);
    console.log('    Email: ', admin.email);
    console.log('    Role:  ', admin.role);
    console.log('');
    console.log('    ⚠️  Remove ADMIN_PASSWORD from .env after seeding is complete.');
    console.log('        Never commit credentials to version control.');
  } else {
    console.log('ℹ️   Admin account already exists for:', adminEmail);
    console.log('    No changes made.');
  }

  // ── 5. Close the pool so the script exits cleanly ───────────
  await pool.end();
}

// Run the function and handle any unexpected errors
seedAdmin().catch((err) => {
  console.error('');
  console.error('❌  Admin seeding failed:', err.message);
  console.error('');
  process.exit(1);
});
