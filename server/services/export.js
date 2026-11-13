// server/services/export.js
// Builds .docx and .pdf files from translated rows.
// Contributed by Person B (commit 235efd4)

const { Document, Packer, Paragraph, TextRun } = require('docx');
const puppeteer = require('puppeteer');

// Rows can be plain strings or objects like { translated: '...' }.
function rowText(row) {
  return typeof row === 'string' ? row : row?.translated ?? row?.text ?? '';
}

// Fonts that include Indic scripts. Word falls back to them for complex-script text.
const FONTS = {
  hi: 'Nirmala UI', mr: 'Nirmala UI', ta: 'Nirmala UI', te: 'Nirmala UI', bn: 'Nirmala UI',
  gu: 'Nirmala UI', kn: 'Nirmala UI', ml: 'Nirmala UI', pa: 'Nirmala UI', or: 'Nirmala UI',
  as: 'Nirmala UI', ur: 'Arial',
};

/**
 * Create a .docx document with one paragraph per row.
 * @param {Array<string|{translated?: string, text?: string}>} rows  Translated sentences
 * @param {string} lang  Language code ('hi', 'ta', ...), used to pick a suitable font
 * @returns {Promise<Buffer>}
 */
async function exportDocx(rows, lang) {
  const font = FONTS[String(lang).toLowerCase()] || 'Nirmala UI';

  const paragraphs = (rows || []).map((row) => {
    const text = rowText(row);
    return new Paragraph({
      spacing: { after: 160 },
      children: [new TextRun({ text, font: { ascii: font, hAnsi: font, cs: font } })],
    });
  });

  const doc = new Document({ sections: [{ children: paragraphs }] });
  return Packer.toBuffer(doc);
}

// Google Noto font for each language's script. Devanagari covers both Hindi and Marathi.
const NOTO_FONTS = {
  hi: 'Noto Sans Devanagari',
  mr: 'Noto Sans Devanagari',
  bn: 'Noto Sans Bengali',
  gu: 'Noto Sans Gujarati',
  ta: 'Noto Sans Tamil',
  te: 'Noto Sans Telugu',
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/**
 * Create a PDF with one paragraph per row, rendered by headless Chrome so Indic
 * conjuncts and vowel signs are shaped correctly (pdfkit can't do this).
 * Needs internet access to load the Noto fonts from Google Fonts.
 * @param {Array<string|{translated?: string, text?: string}>} rows  Translated sentences
 * @param {string} lang  Language code: 'hi', 'mr', 'bn', 'gu', 'ta', 'te'
 * @returns {Promise<Buffer>}
 */
async function exportPdf(rows, lang) {
  const code = String(lang).toLowerCase();
  const primary = NOTO_FONTS[code] || 'Noto Sans Devanagari';

  // Load all six script fonts plus Noto Sans (for Latin text, digits and punctuation),
  // so mixed-script text still renders. The language's own font comes first.
  const families = ['Noto Sans', ...new Set(Object.values(NOTO_FONTS))];
  const fontsUrl =
    'https://fonts.googleapis.com/css2?' +
    families.map((f) => `family=${f.replace(/ /g, '+')}:wght@400;700`).join('&') +
    '&display=block';
  const fontStack = [primary, ...families.filter((f) => f !== primary)].map((f) => `'${f}'`).join(', ');

  const body = (rows || []).map((row) => `<p>${escapeHtml(rowText(row))}</p>`).join('\n');

  const html = `<!doctype html>
<html lang="${escapeHtml(code)}">
<head>
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="${fontsUrl}">
  <style>
    @page { size: A4; margin: 20mm; }
    body { font-family: ${fontStack}, sans-serif; font-size: 12pt; line-height: 1.7; color: #000; }
    p { margin: 0 0 8pt; }
  </style>
</head>
<body>
${body}
</body>
</html>`;

  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.evaluate(() => document.fonts.ready); // don't print until the fonts have loaded
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    return Buffer.from(pdf); // puppeteer returns a Uint8Array
  } finally {
    await browser.close();
  }
}

module.exports = { exportDocx, exportPdf };
