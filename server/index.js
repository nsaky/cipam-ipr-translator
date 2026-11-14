// server/index.js
//
// This is the entry point of the entire backend.
// It is the first file Node.js runs when you type: node server/index.js
//
// Its only jobs are:
//   1. Load environment variables from the .env file (MUST be first)
//   2. Import the configured Express app
//   3. Import the database pool (this triggers the connection test)
//   4. Start listening for incoming HTTP requests on the specified port

'use strict';

// Step 1: Load .env file into process.env
// This MUST happen before any other require() that reads process.env,
// otherwise DATABASE_URL, JWT_SECRET, etc. will all be undefined.
require('dotenv').config();

// Step 2: Import the Express app (which is fully configured in app.js)
const app = require('./app');

// Step 3: Import the database pool.
// Simply requiring it triggers the connection test in db.js.
// If the DB is unreachable, db.js will log the error and call process.exit(1).
require('./config/db');

// Step 4: Determine which port to listen on.
// We read from .env first; if not set, we default to 5000.
const PORT = process.env.PORT || 5000;

// Start the HTTP server.
app.listen(PORT, () => {
  console.log(`🚀  Server running on http://localhost:${PORT}`);
  console.log(`    Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`    Health check: http://localhost:${PORT}/api/health`);
});
