// server/services/translate.js
// English -> Indic translation via Groq's free tier (OpenAI-compatible API).
// Get a free key at https://console.groq.com/keys and set GROQ_API_KEY.
// Requires Node 18+ (built-in fetch). No npm dependencies.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const BATCH_SIZE = 20; // sentences per request; keeps prompts small and inside free-tier token limits
const MAX_RETRIES = 3;

const LANGUAGES = {
  hi: 'Hindi', ta: 'Tamil', te: 'Telugu', bn: 'Bengali', mr: 'Marathi',
  gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi', or: 'Odia',
  ur: 'Urdu', as: 'Assamese',
};

function languageName(lang) {
  return LANGUAGES[String(lang).toLowerCase()] || lang;
}

function buildSystemPrompt(langName, glossary) {
  const entries = Object.entries(glossary || {});
  const glossaryBlock = entries.length
    ? entries.map(([en, tr]) => `- "${en}" => "${tr}"`).join('\n')
    : '(none)';

  return `You are a professional translator translating Intellectual Property Rights (IPR) content from English into ${langName} for the general public.

STYLE RULES (MANDATORY — apply to every sentence, no exceptions):
1. Use SIMPLE, FORMAL ${langName} meant for the general public: plain, clear, official language that any ordinary reader can understand. Avoid literary flourish, archaic terms, and unnecessarily complex legalese.
2. PRESERVE MEANING over literal translation. Do NOT translate word-for-word; if a literal rendering would distort, obscure, or weaken the meaning, rephrase so the meaning comes through intact and natural.
3. SLANG IS ABSOLUTELY FORBIDDEN. Never use slang, colloquialisms, informal contractions, casual tone, or any informal language. This is non-negotiable.
4. Keep numbers, section/article references, names, and acronyms (e.g. WIPO, TRIPS) accurate.
5. Translate every sentence independently and in order. Do not merge, split, skip, or add sentences.

GLOSSARY RULES (MANDATORY):
Whenever an English term below appears in a sentence (any capitalisation, singular or plural),
you MUST use exactly the given ${langName} term. Do not paraphrase it, use synonyms, or transliterate it differently.
${glossaryBlock}

OUTPUT FORMAT:
Respond with ONLY a JSON object of the form {"translations": ["...", "..."]}
containing exactly one translated string per input sentence, in the same order.`;
}

async function callGroq(messages) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set. Get a free key at https://console.groq.com/keys');

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.1, // low = consistent, formal output
        response_format: { type: 'json_object' },
      }),
    });

    // Free tier is rate limited: back off and retry on 429 / 5xx.
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      const wait = Number(res.headers.get('retry-after')) || 2 ** attempt * 2;
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`Groq API error ${res.status}: ${await res.text()}`);

    const data = await res.json();
    return data.choices[0].message.content;
  }
}

// Returns glossary violations: source contains the English term but output lacks the required translation.
function findGlossaryViolations(sources, outputs, glossary) {
  const violations = [];
  for (const [en, tr] of Object.entries(glossary || {})) {
    const re = new RegExp(`\\b${en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    sources.forEach((src, i) => {
      if (re.test(src) && !outputs[i].includes(tr)) violations.push({ index: i, en, tr });
    });
  }
  return violations;
}

async function translateBatch(sentences, langName, glossary) {
  const messages = [
    { role: 'system', content: buildSystemPrompt(langName, glossary) },
    { role: 'user', content: JSON.stringify({ sentences }) },
  ];

  let outputs;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await callGroq(messages);
    try {
      outputs = JSON.parse(raw).translations;
    } catch {
      outputs = null;
    }

    if (!Array.isArray(outputs) || outputs.length !== sentences.length) {
      messages.push({ role: 'assistant', content: raw });
      messages.push({
        role: 'user',
        content: `Invalid output. Return {"translations": [...]} with exactly ${sentences.length} strings, one per input sentence.`,
      });
      continue;
    }

    const violations = findGlossaryViolations(sentences, outputs, glossary);
    if (violations.length === 0) return outputs;

    // One corrective pass for glossary misses.
    messages.push({ role: 'assistant', content: raw });
    messages.push({
      role: 'user',
      content:
        'You did not follow the glossary. Fix these and return the full corrected JSON:\n' +
        violations.map((v) => `- Sentence ${v.index + 1}: "${v.en}" must be translated as "${v.tr}"`).join('\n'),
    });
  }

  if (!Array.isArray(outputs) || outputs.length !== sentences.length) {
    throw new Error('Model did not return one translation per sentence.');
  }
  // Return best effort; log remaining glossary misses (e.g. inflected forms may legitimately differ).
  const left = findGlossaryViolations(sentences, outputs, glossary);
  if (left.length) console.warn('[translate] Glossary terms possibly not applied:', left);
  return outputs;
}

// Accept the glossary either as DB rows [{ en_term, approved_term }] (what the server passes)
// or as a plain object { "patent": "पेटेंट" }.
function toGlossaryObject(glossary) {
  if (!Array.isArray(glossary)) return glossary || {};
  return Object.fromEntries(
    glossary.filter((g) => g && g.en_term && g.approved_term).map((g) => [g.en_term, g.approved_term])
  );
}

/**
 * Translate English sentences into an Indic language.
 * @param {string[]} sentences  English sentences
 * @param {string} lang         Language code ('hi', 'ta', ...) or name ('Hindi')
 * @param {Array<{en_term: string, approved_term: string}>|Object<string,string>} glossary
 *        Terms enforced strictly. DB rows or { "patent": "पेटेंट", ... }
 * @returns {Promise<string[]>} translations, same length and order as input
 */
async function translate(sentences, lang, glossary = {}) {
  if (!Array.isArray(sentences)) throw new TypeError('sentences must be an array of strings');
  glossary = toGlossaryObject(glossary);
  const langName = languageName(lang);
  const results = [];

  for (let i = 0; i < sentences.length; i += BATCH_SIZE) {
    const batch = sentences.slice(i, i + BATCH_SIZE);
    // Only send glossary entries relevant to this batch to keep the prompt short.
    const text = batch.join(' ').toLowerCase();
    const relevant = Object.fromEntries(
      Object.entries(glossary).filter(([en]) => text.includes(en.toLowerCase()))
    );
    results.push(...(await translateBatch(batch, langName, relevant)));
  }
  return results;
}

// Abbreviations that end with "." but don't end a sentence (common in legal/IPR text).
const ABBREVIATIONS = [
  'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr', 'St', 'Sec', 'Secs', 'Art', 'Arts',
  'Cl', 'Ch', 'Vol', 'Fig', 'Para', 'Pg', 'pp', 'Ltd', 'Pvt', 'Inc', 'Co', 'Corp', 'Govt', 'Dept',
  'vs', 'v', 'etc', 'viz', 'approx', 'Jan', 'Feb', 'Mar', 'Apr', 'Jun', 'Jul', 'Aug', 'Sep', 'Sept',
  'Oct', 'Nov', 'Dec', 'e.g', 'i.e', 'U.S', 'U.K',
];
const ABBR_RE = new RegExp(`(?:^|[\\s(])(?:${ABBREVIATIONS.map((a) => a.replace(/\./g, '\\.')).join('|')})$`, 'i');

/**
 * Split a block of English text into sentences.
 * Handles ., !, ? (with trailing quotes/brackets), common abbreviations, decimals,
 * initials like "J. K. Rowling", and blank-line paragraph breaks.
 * @param {string} text
 * @returns {string[]}
 */
function splitSentences(text) {
  if (!text) return [];
  const sentences = [];

  for (const para of String(text).split(/\n\s*\n/)) {
    const flat = para.replace(/\s+/g, ' ').trim();
    let start = 0;
    const boundary = /[.!?]+["')\]]*(?=\s+|$)/g;
    let m;
    while ((m = boundary.exec(flat))) {
      const end = m.index + m[0].length;
      const before = flat.slice(start, m.index);
      const next = flat.slice(end).trimStart();
      const isPeriod = m[0][0] === '.';

      if (isPeriod && next) {
        if (ABBR_RE.test(before)) continue; // "Sec. 3", "e.g. patents"
        if (/(?:^|\s)[A-Z]$/.test(before)) continue; // initials: "J. Smith"
        if (/^[a-z0-9]/.test(next)) continue; // lowercase/number after period: not a new sentence
        if (/(?:^|\s)Nos?$/i.test(before) && /^\d/.test(next)) continue; // "No. 5"
      }
      const s = flat.slice(start, end).trim();
      if (s) sentences.push(s);
      start = end;
    }
    const rest = flat.slice(start).trim();
    if (rest) sentences.push(rest);
  }
  return sentences;
}

module.exports = { translate, splitSentences };
