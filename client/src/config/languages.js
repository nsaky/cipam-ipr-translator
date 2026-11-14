/**
 * Centralized Language Configuration for CIPAM IPR Translator
 *
 * Source Language: English (fixed for this project)
 * Target Languages: Exactly 6 agreed Indian regional languages
 */

export const SOURCE_LANGUAGE = {
  code: 'en',
  name: 'English',
  nativeName: 'English',
  script: 'Latin',
};

export const TARGET_LANGUAGES = [
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    script: 'Devanagari',
    fontFamily: "'Noto Sans Devanagari', 'Plus Jakarta Sans', sans-serif",
    description: 'Official national and regional language of North and Central India.',
  },
  {
    code: 'mr',
    name: 'Marathi',
    nativeName: 'मराठी',
    script: 'Devanagari',
    fontFamily: "'Noto Sans Devanagari', 'Plus Jakarta Sans', sans-serif",
    description: 'Official language of Maharashtra, key center for industrial IPR and trademarks.',
  },
  {
    code: 'bn',
    name: 'Bengali',
    nativeName: 'বাংলা',
    script: 'Bengali',
    fontFamily: "'Noto Sans Bengali', 'Plus Jakarta Sans', sans-serif",
    description: 'Official language of West Bengal and Tripura, rich in cultural and GI assets.',
  },
  {
    code: 'gu',
    name: 'Gujarati',
    nativeName: 'ગુજરાતી',
    script: 'Gujarati',
    fontFamily: "'Noto Sans Gujarati', 'Plus Jakarta Sans', sans-serif",
    description: 'Prominent language of Gujarat, driving commercial MSME innovation and design patents.',
  },
  {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    script: 'Tamil',
    fontFamily: "'Noto Sans Tamil', 'Plus Jakarta Sans', sans-serif",
    description: 'Classical language of Tamil Nadu, significant in software copyright and manufacturing.',
  },
  {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    script: 'Telugu',
    fontFamily: "'Noto Sans Telugu', 'Plus Jakarta Sans', sans-serif",
    description: 'Widely spoken across Andhra Pradesh and Telangana, hub of pharmaceutical patents.',
  },
];

export const getLanguageByCode = (code) => {
  if (!code) return null;
  return TARGET_LANGUAGES.find((lang) => lang.code.toLowerCase() === code.toLowerCase()) || null;
};

export const isValidLanguageCode = (code) => {
  if (!code) return false;
  return TARGET_LANGUAGES.some((lang) => lang.code.toLowerCase() === code.toLowerCase());
};

export default TARGET_LANGUAGES;
