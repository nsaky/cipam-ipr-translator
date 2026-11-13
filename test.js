// test.js — end-to-end check of the translation module: PDF -> sentences -> all target languages -> PDFs.
// Usage: node test.js [input.pdf] [sentenceCount]
//   node test.js                       (uses samples/sample.pdf, first 3 sentences)
//   node test.js samples/scanned.pdf   (scanned PDF, goes through the OCR fallback)
// Needs GROQ_API_KEY, either exported in your shell or in a .env file in this folder.

const fs = require('fs');
const path = require('path');
const { extractText } = require('./services/extract');
const { translate } = require('./services/translate');
const { exportPdf } = require('./services/export');

try {
  process.loadEnvFile(); // Node 21.7+: reads .env if it exists
} catch {}

const input = process.argv[2] || path.join(__dirname, 'samples', 'sample.pdf');
const count = Number(process.argv[3]) || 3;

// Day 3 target languages: Hindi, Marathi, Bengali, Gujarati, Tamil, Telugu
const LANGUAGES = [
  { code: 'hi', name: 'Hindi' },
  { code: 'mr', name: 'Marathi' },
  { code: 'bn', name: 'Bengali' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
];

// Hindi glossary (IPR terms enforced strictly for the Hindi output).
const glossary = {
  patent: 'पेटेंट',
  trademark: 'व्यापार चिह्न',
  copyright: 'प्रतिलिप्यधिकार',
};

async function main() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set. Add it to .env or export it in your shell.');
  }

  console.time('extract');
  const sentences = await extractText(input, 'pdf');
  console.timeEnd('extract');
  console.log(`Extracted ${sentences.length} sentences from ${input}`);
  if (sentences.length === 0) throw new Error('No text found in the PDF.');

  const sample = sentences.slice(0, count);
  console.log(`\nTranslating first ${sample.length} sentence(s) into ${LANGUAGES.length} languages:\n`);

  for (const { code, name } of LANGUAGES) {
    console.time(`translate-${code}`);
    // Glossary is Hindi-only; skip for other languages to avoid false violations.
    const langGlossary = code === 'hi' ? glossary : {};
    const translated = await translate(sample, code, langGlossary);
    console.timeEnd(`translate-${code}`);

    console.log(`\n===== ${name} (${code}) =====`);
    sample.forEach((en, i) => console.log(`EN: ${en}\n${name}: ${translated[i]}\n`));

    console.time(`exportPdf-${code}`);
    const pdf = await exportPdf(translated, code);
    console.timeEnd(`exportPdf-${code}`);
    const output = path.join(__dirname, `output-${code}.pdf`);
    fs.writeFileSync(output, pdf);
    console.log(`Saved ${pdf.length} bytes to ${output}`);
  }
}

main().catch((err) => {
  console.error('\nTEST FAILED:', err.message);
  process.exit(1);
});
