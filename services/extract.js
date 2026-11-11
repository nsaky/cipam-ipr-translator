// services/extract.js
// Extracts text from uploaded documents and splits it into sentences.

const fs = require('fs/promises');
const mammoth = require('mammoth');
const { PDFParse } = require('pdf-parse');
const Tesseract = require('tesseract.js');
const { splitSentences } = require('./translate');

// PDF/OCR text has hard line wraps; re-join words hyphenated across lines ("trade-\nmark" -> "trademark").
function cleanText(text) {
  return text.replace(/(\w)-\n(\w)/g, '$1$2');
}

// Below this many non-space characters, a PDF is treated as scanned and sent to OCR.
const MIN_PDF_TEXT_CHARS = 20;

// OCR several images with one Tesseract worker (much faster than one worker per page).
async function ocrImages(images) {
  const worker = await Tesseract.createWorker('eng');
  try {
    const texts = [];
    for (const img of images) texts.push((await worker.recognize(img)).data.text);
    return texts.join('\n\n'); // blank line between pages = paragraph break for splitSentences
  } finally {
    await worker.terminate();
  }
}

/**
 * Extract text from a file and return it as an array of sentences.
 * @param {string} filePath  Path to the file on disk
 * @param {string} type      'docx', 'pdf', or 'image' (also accepts 'png', 'jpg', 'jpeg')
 * @returns {Promise<string[]>}
 */
async function extractText(filePath, type) {
  switch (String(type).toLowerCase().replace(/^\./, '')) {
    case 'docx': {
      // extractRawText puts a blank line between paragraphs, which splitSentences treats as a paragraph break.
      const { value } = await mammoth.extractRawText({ path: filePath });
      return splitSentences(value);
    }

    case 'pdf': {
      const parser = new PDFParse({ data: await fs.readFile(filePath) });
      try {
        // pageJoiner: '' stops pdf-parse from inserting "-- 1 of 3 --" markers into the text.
        let { text } = await parser.getText({ pageJoiner: '' });

        // Scanned (image-only) PDF: no text layer, so render each page to PNG and OCR it.
        if (text.replace(/\s/g, '').length < MIN_PDF_TEXT_CHARS) {
          const { pages } = await parser.getScreenshot({ scale: 3, imageDataUrl: false });
          text = await ocrImages(pages.map((p) => p.data));
        }
        return splitSentences(cleanText(text));
      } finally {
        await parser.destroy();
      }
    }

    case 'image':
    case 'png':
    case 'jpg':
    case 'jpeg': {
      // Runs locally. The English model (~10 MB) downloads once on first use, then is cached.
      return splitSentences(cleanText(await ocrImages([filePath])));
    }

    default:
      throw new Error(`Unsupported file type: ${type}`);
  }
}

module.exports = { extractText };
