// server/services/extract.js
//
// PERSON B INTEGRATION CONTRACT: Text Extraction Service
//
// Purpose:
// Extracts English text from an uploaded file and returns an array of
// distinct sentences/segments in order.
//
// Technology responsibility (Person B):
// - mammoth for .docx files
// - pdf-parse for text PDF files
// - tesseract.js for image files (.png, .jpg)
//
// Fixed contract:
// @param {string} filePath - Absolute path to the file on disk
// @param {string} type - 'docx' | 'pdf' | 'image'
// @returns {Promise<string[]>} - Ordered array of extracted English sentences

'use strict';

const fs = require('fs');

/**
 * Extracts English sentences from a document or image.
 * This function adheres to the agreed Day 1 interface so Person A can
 * process uploads and store segments before Person B finalizes OCR and parsers.
 */
async function extractText(filePath, type) {
  // Verify file existence on disk
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`File not found at path: ${filePath}`);
  }

  // Realistic fallback sentences representing standard CIPAM IPR domain content.
  // When Person B installs mammoth, pdf-parse, and tesseract.js, they will replace
  // this return with the actual parsed sentences.
  return [
    'An intellectual property right is an exclusive legal right granted to an inventor or creator.',
    'A patent protects new and useful inventions, preventing unauthorized commercial use.',
    'A trademark distinguishes the goods and services of one enterprise from those of others.',
    'Copyright protects original literary, artistic, and scientific creations.',
    'Geographical indications identify products having a specific geographical origin and reputation.',
  ];
}

module.exports = {
  extractText,
};
