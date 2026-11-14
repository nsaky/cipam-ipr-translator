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
    url: process.env.DATABASE_URL,
  },
});
