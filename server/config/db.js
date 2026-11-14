// server/config/db.js
//
// This file creates a "pool" of PostgreSQL connections.
//
// What is a pool?
//   Instead of opening and closing a database connection every time we need
//   to run a query (which is slow), we keep a small set of connections open
//   and reuse them. The pg library manages this automatically.
//
// How to use it in other files:
//   const pool = require('../config/db');
//   const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

'use strict';

const { Pool } = require('pg');

// dotenv is loaded in index.js before anything else runs,
// so process.env.DATABASE_URL is already available here.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test the connection when the server first starts.
// This runs once at startup — it does NOT run on every request.
pool.connect((err, client, release) => {
  if (err) {
    // If we can't connect, log a clear error message and stop.
    console.error('❌  Database connection failed:', err.message);
    console.error('    Check your DATABASE_URL in the .env file.');
    process.exit(1); // Exit the process — there's no point running without a DB
  }

  // Run a simple query to confirm the connection is alive.
  client.query('SELECT NOW()', (queryErr, result) => {
    // Always release the connection back to the pool when done.
    release();

    if (queryErr) {
      console.error('❌  Database test query failed:', queryErr.message);
      process.exit(1);
    }

    console.log('✅  PostgreSQL connected. Server time:', result.rows[0].now);
  });
});

// Export the pool so any controller or config file can import and use it.
module.exports = pool;
