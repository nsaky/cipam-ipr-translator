// prisma.config.js — Prisma CLI settings (Prisma 7+).
// The app itself connects in server/config/db.js using DATABASE_URL.
require('dotenv/config');
const { defineConfig } = require('prisma/config');

module.exports = defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Migrations need a direct (non-pooled) connection. On Neon, set DIRECT_URL to the
    // connection string WITHOUT "-pooler"; locally DATABASE_URL is used for both.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});
