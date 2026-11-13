// server/middleware/upload.js
//
// File Upload Middleware (Multer)
//
// Security & Operational Rules:
// 1. Files are saved in server/uploads/ with randomized UUID filenames to prevent
//    directory traversal, overwrites, and execution of dangerous extensions.
// 2. Strict allow-list of extensions (.docx, .pdf, .png, .jpg, .jpeg) and MIME types.
// 3. 10 MB maximum file size limit.
// 4. Custom error wrapper to return user-friendly HTTP error codes.

'use strict';

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const UPLOADS_DIR = path.resolve(__dirname, '../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Allowed extensions and corresponding canonical source types
const ALLOWED_EXTENSIONS = {
  '.docx': 'docx',
  '.pdf': 'pdf',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
};

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/octet-stream', // Some Windows/browsers send octet-stream for docx
];

// Configure disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

// File filter function
function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_EXTENSIONS[ext]) {
    return cb(
      new Error(
        'Invalid file type. Only .docx, .pdf, .png, and .jpg files are permitted.'
      ),
      false
    );
  }

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      new Error(
        'Invalid MIME type. Uploaded content does not match allowed document or image formats.'
      ),
      false
    );
  }

  cb(null, true);
}

// 10 MB maximum limit
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 megabytes

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // Only one document per upload request
  },
  fileFilter,
});

/**
 * Express middleware wrapper to intercept Multer errors and return clean JSON.
 */
function handleDocumentUpload(req, res, next) {
  const uploadSingle = upload.single('file');

  uploadSingle(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'File size exceeds the 10 MB limit.',
        });
      }
      return res.status(400).json({
        error: err.message || 'File upload validation failed.',
      });
    } else if (err) {
      return res.status(400).json({
        error: err.message || 'An error occurred while uploading the file.',
      });
    }

    next();
  });
}

/**
 * Helper to map file extension to database source_type ('docx' | 'pdf' | 'image')
 */
function getSourceType(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS[ext] || 'pdf';
}

module.exports = {
  handleDocumentUpload,
  getSourceType,
};
