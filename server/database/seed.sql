-- ============================================================
-- CIPAM IPR Translator — Glossary Seed Data
-- File: server/database/seed.sql
--
-- HOW TO RUN:
--   psql -U mekavikas -d cipam_ipr_db -f server/database/seed.sql
--
-- SAFE TO RUN MULTIPLE TIMES:
--   Every INSERT uses ON CONFLICT DO NOTHING.
--   If a term already exists for a language, it is simply skipped.
--   No duplicates are created. No existing data is overwritten.
--
-- LANGUAGES COVERED:
--   hi = Hindi
--   mr = Marathi
--   bn = Bengali
--   gu = Gujarati
--   ta = Tamil
--   te = Telugu
--
-- TERMS COVERED (20 IPR terms per language):
--   Patent, Trademark, Copyright, Geographical Indication,
--   Industrial Design, Intellectual Property, Infringement,
--   Licensing, Patent Holder, Registration, Prior Art, Royalty,
--   Patent Application, Trade Secret, Inventor, Patent Office,
--   Counterfeiting, Exclusive Rights, Public Domain, Assignment
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- HINDI (hi)
-- ────────────────────────────────────────────────────────────
INSERT INTO glossary_terms (en_term, lang, approved_term) VALUES
  ('Patent',                  'hi', 'पेटेंट'),
  ('Trademark',               'hi', 'व्यापार चिह्न'),
  ('Copyright',               'hi', 'प्रतिलिप्याधिकार'),
  ('Geographical Indication', 'hi', 'भौगोलिक संकेत'),
  ('Industrial Design',       'hi', 'औद्योगिक डिज़ाइन'),
  ('Intellectual Property',   'hi', 'बौद्धिक संपदा'),
  ('Infringement',            'hi', 'उल्लंघन'),
  ('Licensing',               'hi', 'लाइसेंसिंग'),
  ('Patent Holder',           'hi', 'पेटेंट धारक'),
  ('Registration',            'hi', 'पंजीकरण'),
  ('Prior Art',               'hi', 'पूर्व कला'),
  ('Royalty',                 'hi', 'रॉयल्टी'),
  ('Patent Application',      'hi', 'पेटेंट आवेदन'),
  ('Trade Secret',            'hi', 'व्यापार रहस्य'),
  ('Inventor',                'hi', 'आविष्कारक'),
  ('Patent Office',           'hi', 'पेटेंट कार्यालय'),
  ('Counterfeiting',          'hi', 'जालसाजी'),
  ('Exclusive Rights',        'hi', 'विशेष अधिकार'),
  ('Public Domain',           'hi', 'सार्वजनिक संपत्ति'),
  ('Assignment',              'hi', 'हस्तांतरण')
ON CONFLICT (lang, en_term) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- MARATHI (mr)
-- ────────────────────────────────────────────────────────────
INSERT INTO glossary_terms (en_term, lang, approved_term) VALUES
  ('Patent',                  'mr', 'पेटंट'),
  ('Trademark',               'mr', 'व्यापारचिन्ह'),
  ('Copyright',               'mr', 'प्रतिलिप्याधिकार'),
  ('Geographical Indication', 'mr', 'भौगोलिक संकेत'),
  ('Industrial Design',       'mr', 'औद्योगिक रचना'),
  ('Intellectual Property',   'mr', 'बौद्धिक संपत्ती'),
  ('Infringement',            'mr', 'उल्लंघन'),
  ('Licensing',               'mr', 'परवानागी'),
  ('Patent Holder',           'mr', 'पेटंट धारक'),
  ('Registration',            'mr', 'नोंदणी'),
  ('Prior Art',               'mr', 'पूर्व तंत्रज्ञान'),
  ('Royalty',                 'mr', 'रॉयल्टी'),
  ('Patent Application',      'mr', 'पेटंट अर्ज'),
  ('Trade Secret',            'mr', 'व्यापारी गुपित'),
  ('Inventor',                'mr', 'संशोधक'),
  ('Patent Office',           'mr', 'पेटंट कार्यालय'),
  ('Counterfeiting',          'mr', 'बनावट निर्मिती'),
  ('Exclusive Rights',        'mr', 'एकमेव अधिकार'),
  ('Public Domain',           'mr', 'सार्वजनिक क्षेत्र'),
  ('Assignment',              'mr', 'हस्तांतरण')
ON CONFLICT (lang, en_term) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- BENGALI (bn)
-- ────────────────────────────────────────────────────────────
INSERT INTO glossary_terms (en_term, lang, approved_term) VALUES
  ('Patent',                  'bn', 'পেটেন্ট'),
  ('Trademark',               'bn', 'ট্রেডমার্ক'),
  ('Copyright',               'bn', 'স্বত্বাধিকার'),
  ('Geographical Indication', 'bn', 'ভৌগোলিক নির্দেশক'),
  ('Industrial Design',       'bn', 'শিল্প নকশা'),
  ('Intellectual Property',   'bn', 'মেধাস্বত্ব'),
  ('Infringement',            'bn', 'লঙ্ঘন'),
  ('Licensing',               'bn', 'লাইসেন্সিং'),
  ('Patent Holder',           'bn', 'পেটেন্ট ধারক'),
  ('Registration',            'bn', 'নিবন্ধন'),
  ('Prior Art',               'bn', 'পূর্ববর্তী শিল্পকলা'),
  ('Royalty',                 'bn', 'রয়্যালটি'),
  ('Patent Application',      'bn', 'পেটেন্ট আবেদন'),
  ('Trade Secret',            'bn', 'বাণিজ্য গোপনীয়তা'),
  ('Inventor',                'bn', 'উদ্ভাবক'),
  ('Patent Office',           'bn', 'পেটেন্ট অফিস'),
  ('Counterfeiting',          'bn', 'জাল পণ্য তৈরি'),
  ('Exclusive Rights',        'bn', 'একচেটিয়া অধিকার'),
  ('Public Domain',           'bn', 'পাবলিক ডোমেইন'),
  ('Assignment',              'bn', 'হস্তান্তর')
ON CONFLICT (lang, en_term) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- GUJARATI (gu)
-- ────────────────────────────────────────────────────────────
INSERT INTO glossary_terms (en_term, lang, approved_term) VALUES
  ('Patent',                  'gu', 'પેટન્ટ'),
  ('Trademark',               'gu', 'ટ્રેડમાર્ક'),
  ('Copyright',               'gu', 'કૉપીરાઇટ'),
  ('Geographical Indication', 'gu', 'ભૌગોલિક સૂચક'),
  ('Industrial Design',       'gu', 'ઔદ્યોગિક ડિઝાઇન'),
  ('Intellectual Property',   'gu', 'બૌદ્ધિક સંપત્તિ'),
  ('Infringement',            'gu', 'ઉલ્લંઘન'),
  ('Licensing',               'gu', 'લાઇસન્સ'),
  ('Patent Holder',           'gu', 'પેટન્ટ ધારક'),
  ('Registration',            'gu', 'નોંધણી'),
  ('Prior Art',               'gu', 'પૂર્વ કળા'),
  ('Royalty',                 'gu', 'રૉયલ્ટી'),
  ('Patent Application',      'gu', 'પેટન્ટ અરજી'),
  ('Trade Secret',            'gu', 'વ્યાપાર ગુપ્તતા'),
  ('Inventor',                'gu', 'શોધક'),
  ('Patent Office',           'gu', 'પેટન્ટ કાર્યાલય'),
  ('Counterfeiting',          'gu', 'નકલ ઉત્પાદન'),
  ('Exclusive Rights',        'gu', 'વિશેષ અધિકાર'),
  ('Public Domain',           'gu', 'જાહેર ક્ષેત્ર'),
  ('Assignment',              'gu', 'સ્થાનાંતર')
ON CONFLICT (lang, en_term) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- TAMIL (ta)
-- ────────────────────────────────────────────────────────────
INSERT INTO glossary_terms (en_term, lang, approved_term) VALUES
  ('Patent',                  'ta', 'காப்புரிமை'),
  ('Trademark',               'ta', 'வணிக முத்திரை'),
  ('Copyright',               'ta', 'பதிப்புரிமை'),
  ('Geographical Indication', 'ta', 'புவியியல் குறிப்பீடு'),
  ('Industrial Design',       'ta', 'தொழில்துறை வடிவமைப்பு'),
  ('Intellectual Property',   'ta', 'அறிவுசார் சொத்து'),
  ('Infringement',            'ta', 'மீறல்'),
  ('Licensing',               'ta', 'உரிமம்'),
  ('Patent Holder',           'ta', 'காப்புரிமை வைத்திருப்பவர்'),
  ('Registration',            'ta', 'பதிவு'),
  ('Prior Art',               'ta', 'முந்தைய கலை'),
  ('Royalty',                 'ta', 'ராயல்டி'),
  ('Patent Application',      'ta', 'காப்புரிமை விண்ணப்பம்'),
  ('Trade Secret',            'ta', 'வர்த்தக இரகசியம்'),
  ('Inventor',                'ta', 'கண்டுபிடிப்பாளர்'),
  ('Patent Office',           'ta', 'காப்புரிமை அலுவலகம்'),
  ('Counterfeiting',          'ta', 'போலி உற்பத்தி'),
  ('Exclusive Rights',        'ta', 'தனித்துவ உரிமைகள்'),
  ('Public Domain',           'ta', 'பொது உரிமம்'),
  ('Assignment',              'ta', 'ஒப்படைப்பு')
ON CONFLICT (lang, en_term) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- TELUGU (te)
-- ────────────────────────────────────────────────────────────
INSERT INTO glossary_terms (en_term, lang, approved_term) VALUES
  ('Patent',                  'te', 'పేటెంట్'),
  ('Trademark',               'te', 'ట్రేడ్‌మార్క్'),
  ('Copyright',               'te', 'కాపీరైట్'),
  ('Geographical Indication', 'te', 'భౌగోళిక సూచిక'),
  ('Industrial Design',       'te', 'పారిశ్రామిక రూపకల్పన'),
  ('Intellectual Property',   'te', 'మేధో సంపత్తి'),
  ('Infringement',            'te', 'ఉల్లంఘన'),
  ('Licensing',               'te', 'లైసెన్సింగ్'),
  ('Patent Holder',           'te', 'పేటెంట్ హోల్డర్'),
  ('Registration',            'te', 'నమోదు'),
  ('Prior Art',               'te', 'పూర్వ కళ'),
  ('Royalty',                 'te', 'రాయల్టీ'),
  ('Patent Application',      'te', 'పేటెంట్ దరఖాస్తు'),
  ('Trade Secret',            'te', 'వ్యాపార రహస్యం'),
  ('Inventor',                'te', 'ఆవిష్కర్త'),
  ('Patent Office',           'te', 'పేటెంట్ కార్యాలయం'),
  ('Counterfeiting',          'te', 'నకిలీ తయారీ'),
  ('Exclusive Rights',        'te', 'ప్రత్యేక హక్కులు'),
  ('Public Domain',           'te', 'పబ్లిక్ డొమైన్'),
  ('Assignment',              'te', 'అప్పగింత')
ON CONFLICT (lang, en_term) DO NOTHING;

COMMIT;

-- ────────────────────────────────────────────────────────────
-- Confirm seed counts
-- ────────────────────────────────────────────────────────────
SELECT lang, COUNT(*) AS term_count
FROM   glossary_terms
GROUP  BY lang
ORDER  BY lang;
