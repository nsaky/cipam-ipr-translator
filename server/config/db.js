// server/config/db.js
//
// Creates the single shared Prisma Client used by the whole backend.
//
// How to use it in other files:
//   const prisma = require('../config/db');
//   const user = await prisma.user.findUnique({ where: { id: userId } });
//
// Prisma 7 connects through a "driver adapter". @prisma/adapter-pg uses the
// standard `pg` driver and keeps a connection pool for us.
// The schema lives in prisma/schema.prisma; run `npx prisma generate` after editing it.

'use strict';

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

// dotenv is loaded in index.js (or the calling script) before this file runs.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Check the database connection once at startup. Exits the process if it fails,
 * since there's no point running the server without a database.
 */
async function checkConnection() {
  try {
    const [{ now }] = await prisma.$queryRaw`SELECT NOW() AS now`;
    console.log('✅  PostgreSQL connected (Prisma). Server time:', now);
  } catch (err) {
    console.error('❌  Database connection failed:', err.message);
    console.error('    Check your DATABASE_URL in the .env file.');
    process.exit(1);
  }
}

module.exports = prisma;
module.exports.checkConnection = checkConnection;
