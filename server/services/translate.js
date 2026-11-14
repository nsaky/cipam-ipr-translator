// server/services/translate.js
//
// PERSON B INTEGRATION CONTRACT: Translation Service
//
// Purpose:
// Translates an array of English sentences into the requested Indian language
// ('hi', 'mr', 'bn', 'gu', 'ta', 'te') while preserving official IPR glossary terms.
//
// Technology responsibility (Person B):
// - Hosted API: LLM (OpenAI/Anthropic/Gemini) or Bhashini / Google Cloud Translation
// - Prompts tuned for meaning-faithful, short, formal public phrasing
// - Injection of glossary terms into translation requests
// - Batching sentences (20-30 per call) to avoid rate limits
//
// Agreed Fixed Function Contract:
// @param {string[]} sentences - Array of extracted English sentence strings
// @param {string}   lang      - Target language code ('hi', 'mr', 'bn', 'gu', 'ta', 'te')
// @param {Array}    glossary  - Array of { en_term: string, approved_term: string } objects
// @returns {Promise<string[]>} - Array of translated sentences in identical order and length

'use strict';

// Target language localized placeholders for standard domain sentences
const LANGUAGE_SAMPLES = {
  hi: {
    prefix: '[हिंदी]',
    translations: {
      'An intellectual property right is an exclusive legal right granted to an inventor or creator.':
        'बौद्धिक संपदा अधिकार किसी आविष्कारक या निर्माता को दिया गया एक विशेष कानूनी अधिकार है।',
      'A patent protects new and useful inventions, preventing unauthorized commercial use.':
        'एक पेटेंट नए और उपयोगी आविष्कारों की रक्षा करता है, जिससे अनधिकृत वाणिज्यिक उपयोग रोका जा सकता है।',
      'A trademark distinguishes the goods and services of one enterprise from those of others.':
        'व्यापार चिह्न किसी एक उद्यम की वस्तुओं और सेवाओं को दूसरों से अलग पहचान देता है।',
      'Copyright protects original literary, artistic, and scientific creations.':
        'प्रतिलिप्याधिकार मूल साहित्यिक, कलात्मक और वैज्ञानिक कृतियों की रक्षा करता है।',
      'Geographical indications identify products having a specific geographical origin and reputation.':
        'भौगोलिक संकेत उन उत्पादों की पहचान करते हैं जिनकी एक विशिष्ट भौगोलिक उत्पत्ति और प्रतिष्ठा होती है।',
    },
  },
  mr: {
    prefix: '[मराठी]',
    translations: {
      'An intellectual property right is an exclusive legal right granted to an inventor or creator.':
        'बौद्धिक संपत्ती अधिकार हा संशोधकाला किंवा निर्मात्याला दिलेला विशेष कायदेशीर अधिकार आहे.',
      'A patent protects new and useful inventions, preventing unauthorized commercial use.':
        'पेटंट नवीन आणि उपयुक्त शोधांचे संरक्षण करते आणि अनधिकृत व्यावसायिक वापरावर बंदी घालते.',
      'A trademark distinguishes the goods and services of one enterprise from those of others.':
        'व्यापारचिन्ह एका उपक्रमाच्या वस्तू आणि सेवा इतरांपासून वेगळे ठरवते.',
      'Copyright protects original literary, artistic, and scientific creations.':
        'प्रतिलिप्याधिकार मूळ साहित्यिक, कलात्मक आणि वैज्ञानिक निर्मितीचे रक्षण करतो.',
      'Geographical indications identify products having a specific geographical origin and reputation.':
        'भौगोलिक संकेत विशिष्ट भौगोलिक मूळ आणि प्रतिष्ठा असलेल्या उत्पादनांची ओळख करून देतात.',
    },
  },
  bn: {
    prefix: '[বাংলা]',
    translations: {
      'An intellectual property right is an exclusive legal right granted to an inventor or creator.':
        'মেধাস্বত্ব অধিকার হলো কোনো উদ্ভাবক বা স্রষ্টাকে প্রদত্ত একটি একচেটিয়া আইনি অধিকার।',
      'A patent protects new and useful inventions, preventing unauthorized commercial use.':
        'একটি পেটেন্ট নতুন ও দরকারী উদ্ভাবনকে সুরক্ষা দেয় এবং অননুমোদিত বাণিজ্যিক ব্যবহার রোধ করে।',
      'A trademark distinguishes the goods and services of one enterprise from those of others.':
        'ট্রেডমার্ক একটি উদ্যোগের পণ্য ও সেবাকে অন্যদের থেকে আলাদা করে।',
      'Copyright protects original literary, artistic, and scientific creations.':
        'স্বত্বাধিকার মূল সাহিত্য, শিল্প ও বৈজ্ঞানিক সৃষ্টিকে সুরক্ষা প্রদান করে।',
      'Geographical indications identify products having a specific geographical origin and reputation.':
        'ভৌগোলিক নির্দেশক এমন পণ্য চিহ্নিত করে যার একটি নির্দিষ্ট ভৌগোলिक উৎস ও খ্যাতি রয়েছে।',
    },
  },
  gu: {
    prefix: '[ગુજરાતી]',
    translations: {
      'An intellectual property right is an exclusive legal right granted to an inventor or creator.':
        'બૌદ્ધિક સંપત્તિ અધિકાર એ શોધક અથવા સર્જકને આપવામાં આવેલ વિશિષ્ટ કાનૂની અધિકાર છે.',
      'A patent protects new and useful inventions, preventing unauthorized commercial use.':
        'પેટન્ટ નવી અને ઉપયોગી શોધોનું રક્ષણ કરે છે અને અનધિકૃત વ્યવસાયિક ઉપયોગ અટકાવે છે.',
      'A trademark distinguishes the goods and services of one enterprise from those of others.':
        'ટ્રેડમાર્ક એક સાહસના માલ અને સેવાઓને અન્યથી અલગ પાડે છે.',
      'Copyright protects original literary, artistic, and scientific creations.':
        'કૉપીરાઇટ મૂળ સાહિત્યિક, કલાત્મક અને વૈજ્ઞાનિક સર્જનોનું રક્ષણ કરે છે.',
      'Geographical indications identify products having a specific geographical origin and reputation.':
        'ભૌગોલિક સૂચક વિશિષ્ટ ભૌગોલિક મૂળ અને પ્રતિષ્ઠા ધરાવતા ઉત્પાદનોને ઓળખે છે.',
    },
  },
  ta: {
    prefix: '[தமிழ்]',
    translations: {
      'An intellectual property right is an exclusive legal right granted to an inventor or creator.':
        'அறிவுசார் சொத்துரிமை என்பது ஒரு கண்டுபிடிப்பாளர் அல்லது படைப்பாளருக்கு வழங்கப்படும் பிரத்யேக சட்டப்பூர்வ உரிமையாகும்.',
      'A patent protects new and useful inventions, preventing unauthorized commercial use.':
        'காப்புரிமை புதிய மற்றும் பயனுள்ள கண்டுபிடிப்புகளைப் பாதுகாக்கிறது, அங்கீகரிக்கப்படாத வணிகப் பயன்பாட்டைத் தடுக்கிறது.',
      'A trademark distinguishes the goods and services of one enterprise from those of others.':
        'வணிக முத்திரை ஒரு நிறுவனத்தின் பொருட்கள் மற்றும் சேவைகளை மற்றவர்களிடமிருந்து வேறுபடுத்திக் காட்டுகிறது.',
      'Copyright protects original literary, artistic, and scientific creations.':
        'பதிப்புரிமை அசல் இலக்கிய, கலை மற்றும் அறிவியல் படைப்புகளைப் பாதுகாக்கிறது.',
      'Geographical indications identify products having a specific geographical origin and reputation.':
        'புவியியல் குறிப்பீடுகள் ஒரு குறிப்பிட்ட புவியியல் தோற்றம் மற்றும் நற்பெயரைக் கொண்ட தயாரிப்புகளை அடையாளம் காட்டுகின்றன.',
    },
  },
  te: {
    prefix: '[తెలుగు]',
    translations: {
      'An intellectual property right is an exclusive legal right granted to an inventor or creator.':
        'మేధో సంపత్తి హక్కు అనేది ఆవిష్కర్తకు లేదా సృష్టికర్తకు ఇవ్వబడిన ప్రత్యేక చట్టపరమైన హక్కు.',
      'A patent protects new and useful inventions, preventing unauthorized commercial use.':
        'పేటెంట్ కొత్త మరియు ఉపయోగకరమైన ఆవిష్కరణలను రక్షిస్తుంది, అనధికార వాణిజ్య వినియోగాన్ని నిరోధిస్తుంది.',
      'A trademark distinguishes the goods and services of one enterprise from those of others.':
        'ట్రేడ్‌మార్క్ ఒక సంస్థ యొక్క వస్తువులు మరియు సేవలను ఇతరుల నుండి వేరు చేస్తుంది.',
      'Copyright protects original literary, artistic, and scientific creations.':
        'కాపీరైట్ అసలు సాహిత్య, కళాత్మక మరియు శాస్త్రీయ సృష్టిలను రక్షిస్తుంది.',
      'Geographical indications identify products having a specific geographical origin and reputation.':
        'భౌగోళిక సూచికలు నిర్దిష్ట భౌగోళిక మూలం మరియు కీర్తిని కలిగి ఉన్న ఉత్పత్తులను గుర్తిస్తాయి.',
    },
  },
};

/**
 * Agreed translation function contract.
 * Person B replaces this stub with their hosted translation API caller.
 */
async function translate(sentences, lang, glossary = []) {
  if (!Array.isArray(sentences)) {
    throw new Error('Invalid input: sentences must be an array of strings.');
  }

  const supportedLanguages = ['hi', 'mr', 'bn', 'gu', 'ta', 'te'];
  if (!supportedLanguages.includes(lang)) {
    throw new Error(`Unsupported language code: ${lang}. Supported: ${supportedLanguages.join(', ')}`);
  }

  // Allow simulated engine failure for error handling verification
  if (process.env.SIMULATE_TRANSLATION_FAILURE === 'true') {
    throw new Error('External translation service connection timeout (Simulated Failure).');
  }

  const langPack = LANGUAGE_SAMPLES[lang] || { prefix: `[${lang}]`, translations: {} };

  // Map each sentence to its translated equivalent, utilizing glossary if available
  return sentences.map((sentence) => {
    const trimmed = sentence.trim();
    if (langPack.translations[trimmed]) {
      return langPack.translations[trimmed];
    }

    // Dynamic translation with glossary replacement if exact sample not matched
    let translated = `${langPack.prefix} ${trimmed}`;
    if (Array.isArray(glossary) && glossary.length > 0) {
      glossary.forEach(({ en_term, approved_term }) => {
        if (en_term && approved_term) {
          const regex = new RegExp(`\\b${en_term}\\b`, 'gi');
          translated = translated.replace(regex, approved_term);
        }
      });
    }
    return translated;
  });
}

module.exports = {
  translate,
};
