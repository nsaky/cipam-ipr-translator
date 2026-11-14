import api from './api';
import { isValidLanguageCode, getLanguageByCode } from '../config/languages';

/**
 * Translation Service
 *
 * Implements client-side translation workflows conforming to the agreed Person A API:
 * 1. POST /documents/:id/translate
 *    Request body: { "lang": "hi" }
 *    Note: Accepts exactly one language code per request.
 *
 * 2. GET /documents/:id/translations?lang=hi
 *    Retrieves translation results for the specified language.
 *
 * 3. PATCH /translations/:id
 *    Updates a single translation record:
 *    - To update human-edited text: { "final_text": "Updated translation" }
 *    - To update approval status:   { "approved": true } or { "approved": false }
 *
 * Critical Data Distinction:
 * - original_text: Original English sentence (read-only)
 * - machine_text: Original machine-generated translation (read-only baseline)
 * - final_text: Human-editable translation that will be reviewed & exported
 * - approved: Boolean indicating reviewer sign-off
 */

const USE_MOCK = import.meta.env.VITE_USE_MOCK_TRANSLATIONS !== 'false';
const MOCK_TRANSLATIONS_STORAGE_KEY = 'cipam_mock_translations';

// Realistic IPR educational corpus for demonstration and mock testing
const SAMPLE_IPR_CORPUS = {
  default: [
    {
      id: 's_1',
      originalText: 'Intellectual property refers to creations of the mind, such as inventions, literary and artistic works, designs, symbols, names and images used in commerce.',
      translations: {
        hi: 'बौद्धिक संपदा मन की रचनाओं को संदर्भित करती है, जैसे कि आविष्कार, साहित्यिक और कलात्मक कार्य, डिज़ाइन, वाणिज्य में उपयोग किए जाने वाले प्रतीक, नाम और चित्र।',
        mr: 'बौद्धिक संपदा म्हणजे मनाच्या निर्मितीचा संदर्भ देते, जसे की शोध, साहित्यिक आणि कलात्मक कामे, डिझाईन्स, व्यापारात वापरली जाणारी चिन्हे, नावे आणि प्रतिमा.',
        bn: 'বুদ্ধিবৃত্তিক সম্পত্তি মনের সৃষ্টিকে বোঝায়, যেমন উদ্ভাবন, সাহিত্য ও শৈল্পিক কাজ, নকশা, বাণিজ্যে ব্যবহৃত প্রতীক, নাম ও চিত্র।',
        gu: 'બૌદ્ધિક સંપદા મનની રચનાઓનો સંદર્ભ આપે છે, જેમ કે શોધો, સાહિત્યિક અને કલાત્મક કાર્યો, ડિઝાઇન્સ, વાણિજ્યમાં વપરાતા પ્રતીકો, નામો અને છબીઓ.',
        ta: 'அறிவுசார் சொத்து என்பது கண்டுபிடிப்புகள், இலக்கிய மற்றும் கலைப் படைப்புகள், வடிவமைப்புகள், வணிகத்தில் பயன்படுத்தப்படும் சின்னங்கள், பெயர்கள் மற்றும் படங்கள் போன்ற மனதின் படைப்புகளைக் குறிக்கிறது.',
        te: 'మేధో సంపత్తి అనేది ఆవిష్కరణలు, సాహిత్య మరియు కళాత్మక రచనలు, నమూనాలు, వాణిజ్యంలో ఉపయోగించే చిహ్నాలు, పేర్లు మరియు చిత్రాలు వంటి మనస్సు యొక్క సృష్టిని సూచిస్తుంది.',
      },
    },
    {
      id: 's_2',
      originalText: 'Patents protect new and useful inventions, providing the inventor exclusive legal rights to prevent unauthorized commercial exploitation for twenty years.',
      translations: {
        hi: 'पेटेंट नए और उपयोगी आविष्कारों की रक्षा करते हैं, जिससे आविष्कारक को बीस वर्षों तक अनधिकृत व्यावसायिक दोहन को रोकने का विशेष कानूनी अधिकार मिलता है।',
        mr: 'पेटंट नवीन आणि उपयुक्त शोधांचे संरक्षण करतात, ज्यामुळे शोधकर्त्याला वीस वर्षांसाठी अनधिकृत व्यावसायिक शोषण रोखण्यासाठी अनन्य कायदेशीर अधिकार मिळतात.',
        bn: 'পেটেন্ট নতুন এবং দরকারী উদ্ভাবন রক্ষা করে, যা উদ্ভাবককে বিশ বছর ধরে অননুমোদিত বাণিজ্যিক শোষণ প্রতিরোধ করার জন্য একচেটিয়া আইনি অধিকার প্রদান করে।',
        gu: 'પેટન્ટ નવી અને ઉપયોગી શોધોનું રક્ષણ કરે છે, જે સંશોધકને વીસ વર્ષ સુધી અનધિકૃત વ્યાપારી શોષણ અટકાવવા માટે વિશિષ્ટ કાનૂની અધિકારો પ્રદાન કરે છે.',
        ta: 'காப்புரிமைகள் புதிய மற்றும் பயனுள்ள கண்டுபிடிப்புகளைப் பாதுகாக்கின்றன, இருபது ஆண்டுகளுக்கு அங்கீகரிக்கப்படாத வணிகச் சுரண்டலைத் தடுக்க கண்டுபிடிப்பாளருக்கு பிரத்யேக சட்டப்பூர்வ உரிமைகளை வழங்குகின்றன.',
        te: 'పేటెంట్లు కొత్త మరియు ఉపయోగకరమైన ఆవిష్కరణలను రక్షిస్తాయి, ఇరవై సంవత్సరాల పాటు అనధికారిక వాణిజ్య దోపిడీని నిరోధించడానికి ఆవిష్కర్తకు ప్రత్యేకమైన చట్టపరమైన హక్కులను అందిస్తాయి.',
      },
    },
    {
      id: 's_3',
      originalText: 'A trademark distinguishes the goods or services of one enterprise from those of other commercial entities in the marketplace.',
      translations: {
        hi: 'ट्रेडमार्क एक उद्यम के सामान या सेवाओं को बाजार में अन्य वाणिज्यिक संस्थाओं से अलग करता है।',
        mr: 'ट्रेडमार्क बाजारातील इतर व्यावसायिक घटकांपासून एका उपक्रमाच्या वस्तू किंवा सेवा वेगळे करतो.',
        bn: 'একটি ট্রেডমার্ক বাজারে অন্যান্য বাণিজ্যিক সত্তার পণ্য বা পরিষেবা থেকে একটি এন্টারপ্রাইজের পণ্য বা পরিষেবাকে আলাদা করে।',
        gu: 'ટ્રેડમાર્ક બજારમાં અન્ય વાણિજ્યિક એકમોની વસ્તુઓ અથવા સેવાઓથી એક સાહસની વસ્તુઓ અથવા સેવાઓને અલગ પાડે છે.',
        ta: 'ஒரு வர்த்தக முத்திரை சந்தையில் உள்ள பிற வணிக நிறுவனங்களின் பொருட்களிலிருந்து அல்லது சேவைகளிலிருந்து ஒரு நிறுவனத்தின் பொருட்களை வேறுபடுத்துகிறது.',
        te: 'ట్రేడ్‌మార్క్ మార్కెట్‌లోని ఇతర వాణిజ్య సంస్థల నుండి ఒక సంస్థ యొక్క వస్తువులు లేదా సేవలను వేరు చేస్తుంది.',
      },
    },
    {
      id: 's_4',
      originalText: 'Geographical Indications identify goods as originating in a specific territory where a given quality, reputation or characteristic is attributable to its geographical origin.',
      translations: {
        hi: 'भौगोलिक उपदर्शन (जीआई) उन सामानों की पहचान करते हैं जो किसी विशिष्ट क्षेत्र से उत्पन्न होते हैं जहां एक दी गई गुणवत्ता, प्रतिष्ठा या विशेषता इसके भौगोलिक उद्भव के लिए जिम्मेदार होती है।',
        mr: 'भौगोलिक संकेत अशा वस्तू ओळखतात ज्या विशिष्ट प्रदेशातून उद्भवतात जेथे विशिष्ट गुणवत्ता, प्रतिष्ठा किंवा वैशिष्ट्य त्याच्या भौगोलिक उत्पत्तीस कारणीभूत असते.',
        bn: 'ভৌগোলিক ইঙ্গিতগুলি এমন পণ্যগুলিকে চিহ্নিত করে যা একটি নির্দিষ্ট অঞ্চল থেকে উদ্ভূত যেখানে একটি নির্দিষ্ট গুণমান, খ্যাতি বা বৈশিষ্ট্য তার ভৌগোলিক উৎপত্তির জন্য দায়ী।',
        gu: 'ભૌગોલિક સંકેતો (જીઆઈ) એવા માલસામાનને ઓળખે છે જે ચોક્કસ પ્રદેશમાંથી ઉદ્ભવતા હોય જ્યાં ચોક્કસ ગુણવત્તા, પ્રતિષ્ઠા અથવા લાક્ષણિકતા તેના ભૌગોલિક મૂળને આભારી હોય.',
        ta: 'புவிசார் குறியீடுகள் ஒரு குறிப்பிட்ட பகுதியில் இருந்து உருவாகும் பொருட்களை அடையாளம் காண்கின்றன, அங்கு கொடுக்கப்பட்ட தரம், நற்பெயர் அல்லது பண்பு அதன் புவியியல் தோற்றத்திற்குக் காரணமாகும்.',
        te: 'భౌగోళిక సూచికలు నిర్దిష్ట భూభాగం నుండి ఉద్భవించిన వస్తువులను గుర్తిస్తాయి, ఇక్కడ ఇచ్చిన నాణ్యత, ఖ్యాతి లేదా లక్షణం దాని భౌగోళిక మూలానికి ఆపాదించబడుతుంది.',
      },
    },
    {
      id: 's_5',
      originalText: 'Copyright safeguards original literary, dramatic, musical, artistic works, cinematograph films and sound recordings from unauthorized reproduction.',
      translations: {
        hi: 'कॉपीराइट मूल साहित्यिक, नाटकीय, संगीतमय, कलात्मक कार्यों, छायांकन फिल्मों और ध्वनि रिकॉर्डिंग को अनधिकृत पुनरुत्पादन से सुरक्षित रखता है।',
        mr: 'कॉपीराइट मूळ साहित्यिक, नाट्य, संगीत, कलात्मक कामे, छायाचित्रण चित्रपट आणि ध्वनी मुद्रणांचे अनधिकृत पुनरुत्पादनापासून संरक्षण करते.',
        bn: 'কপিরাইট অননুমোদিত প্রজনন থেকে মূল সাহিত্য, নাটকীয়, বাদ্যযন্ত্র, শৈল্পিক কাজ, সিনেমাটোগ্রাফ ফিল্ম এবং সাউন্ড রেকর্ডিং রক্ষা করে।',
        gu: 'કૉપિરાઇટ મૂળ સાહિત્યિક, નાટકીય, સંગીતમય, કલાત્મક કાર્યો, સિનેમેટોગ્રાફ ફિલ્મો અને ધ્વનિ રેકોર્ડિંગ્સને અનધિકૃત પુનઃઉત્પાદનથી સુરક્ષિત કરે છે.',
        ta: 'பதிப்புரிமை அசல் இலக்கிய, நாடக, இசை, கலைப் படைப்புகள், ஒளிப்பதிவுத் திரைப்படங்கள் மற்றும் ஒலிப் பதிவுகளை அங்கீகரிக்கப்படாத மறுஉருவாக்கத்திலிருந்து பாதுகாக்கிறது.',
        te: 'కాపీరైట్ అసలైన సాహిత్య, నాటకీయ, సంగీత, కళాత్మక రచనలు, సినిమాటోగ్రాఫ్ చిత్రాలు మరియు సౌండ్ రికార్డింగ్‌లను అనధికారిక పునరుత్పత్తి నుండి కాపాడుతుంది.',
      },
    },
  ],
};

const getStoredMockTranslations = () => {
  try {
    const raw = localStorage.getItem(MOCK_TRANSLATIONS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('Could not read mock translations store from localStorage', err);
  }
  return {};
};

const saveStoredMockTranslations = (store) => {
  try {
    localStorage.setItem(MOCK_TRANSLATIONS_STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.warn('Could not persist mock translations store to localStorage', err);
  }
};

const simulateDelay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));

export const translationService = {
  /**
   * Request translation of a document into a specific language.
   * Conforms to Person A's API: POST /documents/:id/translate with body { lang: "hi" }
   */
  async translateDocument(documentId, langCode) {
    if (!documentId) throw new Error('Document identifier is required.');
    if (!isValidLanguageCode(langCode)) {
      throw new Error(`Unsupported target language code "${langCode}".`);
    }

    if (USE_MOCK) {
      await simulateDelay(850 + Math.random() * 400);

      const store = getStoredMockTranslations();
      const storageKey = `${documentId}_${langCode}`;

      // Assemble sentence pairs with explicit original_text, machine_text, final_text, approved fields
      const corpus = SAMPLE_IPR_CORPUS.default;
      const sentences = corpus.map((item, idx) => {
        const machineTranslation =
          item.translations[langCode] ||
          `[${langCode.toUpperCase()} Translation] ${item.originalText}`;

        return {
          id: `trans_${documentId}_${langCode}_${idx + 1}`,
          sentenceNumber: idx + 1,
          original_text: item.originalText,
          machine_text: machineTranslation,
          final_text: machineTranslation, // Initially populated from machine_text
          approved: false, // Default not approved
          originalText: item.originalText, // Backwards compatibility for results view
          translatedText: machineTranslation,
        };
      });

      const translationRecord = {
        documentId: String(documentId),
        language: langCode,
        languageMeta: getLanguageByCode(langCode),
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
        sentenceCount: sentences.length,
        sentences: sentences,
      };

      store[storageKey] = translationRecord;
      saveStoredMockTranslations(store);

      return translationRecord;
    }

    // Real API Mode: POST /documents/:id/translate { "lang": "hi" }
    const response = await api.post(`/documents/${documentId}/translate`, {
      lang: langCode,
    });

    if (response.data?.sentences || response.data?.translations) {
      return this.normalizeTranslationResponse(response.data, documentId, langCode);
    }

    return await this.getTranslations(documentId, langCode);
  },

  /**
   * Retrieve existing translations for a document and language.
   * Conforms to Person A's API: GET /documents/:id/translations?lang=hi
   */
  async getTranslations(documentId, langCode) {
    if (!documentId) throw new Error('Document identifier is required.');
    if (!isValidLanguageCode(langCode)) {
      throw new Error(`Unsupported target language code "${langCode}".`);
    }

    if (USE_MOCK) {
      await simulateDelay(200);
      const store = getStoredMockTranslations();
      const storageKey = `${documentId}_${langCode}`;
      let record = store[storageKey];

      if (!record) {
        // Auto-seed default completed record for established documents if not yet translated
        const corpus = SAMPLE_IPR_CORPUS.default;
        const sentences = corpus.map((item, idx) => {
          const machineTranslation =
            item.translations[langCode] ||
            `[${langCode.toUpperCase()} Translation] ${item.originalText}`;

          return {
            id: `trans_${documentId}_${langCode}_${idx + 1}`,
            sentenceNumber: idx + 1,
            original_text: item.originalText,
            machine_text: machineTranslation,
            final_text: machineTranslation,
            approved: false,
            originalText: item.originalText,
            translatedText: machineTranslation,
          };
        });

        record = {
          documentId: String(documentId),
          language: langCode,
          languageMeta: getLanguageByCode(langCode),
          status: 'COMPLETED',
          completedAt: new Date().toISOString(),
          sentenceCount: sentences.length,
          sentences: sentences,
        };

        store[storageKey] = record;
        saveStoredMockTranslations(store);
      }

      // Ensure all sentences have the required Part 4 fields initialized
      record.sentences = record.sentences.map((s, idx) => ({
        id: s.id || `trans_${documentId}_${langCode}_${idx + 1}`,
        sentenceNumber: s.sentenceNumber || idx + 1,
        original_text: s.original_text || s.originalText || '',
        machine_text: s.machine_text || s.translatedText || '',
        final_text: s.final_text || s.translatedText || s.machine_text || '',
        approved: typeof s.approved === 'boolean' ? s.approved : false,
        originalText: s.original_text || s.originalText || '',
        translatedText: s.final_text || s.translatedText || '',
      }));

      return record;
    }

    // Real API Mode: GET /documents/:id/translations?lang=hi
    const response = await api.get(`/documents/${documentId}/translations`, {
      params: { lang: langCode },
    });

    return this.normalizeTranslationResponse(response.data, documentId, langCode);
  },

  /**
   * Save an edited translation for a sentence.
   * Conforms to Person A's API: PATCH /translations/:id with body { "final_text": "..." }
   *
   * @param {string} translationId - The ID of the individual sentence translation record
   * @param {string} finalText - The human-edited final text
   * @param {Object} context - Optional { documentId, langCode } to locate and persist in mock mode
   */
  async updateFinalText(translationId, finalText, context = {}) {
    if (!translationId) throw new Error('Translation record ID is required.');
    const trimmed = (finalText || '').trim();
    if (!trimmed) {
      throw new Error('Final translation text cannot be empty.');
    }

    if (USE_MOCK) {
      await simulateDelay(300);
      const store = getStoredMockTranslations();

      // Locate sentence in the store
      let foundSentence = null;
      for (const key of Object.keys(store)) {
        const record = store[key];
        const match = record.sentences?.find((s) => s.id === translationId);
        if (match) {
          match.final_text = trimmed;
          match.translatedText = trimmed;
          // Re-review trigger: if edited, mark as unapproved requiring re-verification
          match.approved = false;
          foundSentence = match;
          break;
        }
      }

      saveStoredMockTranslations(store);

      return {
        id: translationId,
        final_text: trimmed,
        approved: false,
        message: 'Translation saved successfully.',
      };
    }

    // Real API Mode: PATCH /translations/:id { "final_text": trimmed }
    const response = await api.patch(`/translations/${translationId}`, {
      final_text: trimmed,
    });

    return response.data;
  },

  /**
   * Update the approval status for a sentence.
   * Conforms to Person A's API: PATCH /translations/:id with body { "approved": true/false }
   *
   * @param {string} translationId
   * @param {boolean} approved
   */
  async updateApprovalStatus(translationId, approved = true) {
    if (!translationId) throw new Error('Translation record ID is required.');

    if (USE_MOCK) {
      await simulateDelay(250);
      const store = getStoredMockTranslations();

      let foundSentence = null;
      for (const key of Object.keys(store)) {
        const record = store[key];
        const match = record.sentences?.find((s) => s.id === translationId);
        if (match) {
          match.approved = Boolean(approved);
          foundSentence = match;
          break;
        }
      }

      saveStoredMockTranslations(store);

      return {
        id: translationId,
        approved: Boolean(approved),
        message: approved ? 'Sentence approved.' : 'Sentence reopened for review.',
      };
    }

    // Real API Mode: PATCH /translations/:id { "approved": approved }
    const response = await api.patch(`/translations/${translationId}`, {
      approved: Boolean(approved),
    });

    return response.data;
  },

  /**
   * Calculate review and approval statistics from sentence list
   */
  calculateReviewStats(sentences = []) {
    const total = sentences.length;
    const approvedCount = sentences.filter((s) => s.approved === true).length;
    const pendingCount = total - approvedCount;
    const progressPercent = total > 0 ? Math.round((approvedCount / total) * 100) : 0;

    return {
      total,
      approvedCount,
      pendingCount,
      progressPercent,
      isAllApproved: total > 0 && approvedCount === total,
    };
  },

  /**
   * Normalize backend response envelopes into a consistent UI model
   */
  normalizeTranslationResponse(rawData, documentId, langCode) {
    const data = rawData?.data || rawData?.translation || rawData || {};
    const rawSentences = data.sentences || data.rows || data.items || [];

    const normalizedSentences = rawSentences.map((item, index) => {
      const original = item.original_text || item.originalText || item.source || item.original || '';
      const machine = item.machine_text || item.machineText || item.translatedText || item.target || item.translation || '';
      const final = item.final_text || item.finalText || machine;
      const approved = typeof item.approved === 'boolean' ? item.approved : false;

      return {
        id: item.id || `trans_${documentId}_${langCode}_${index + 1}`,
        sentenceNumber: item.sentenceNumber || index + 1,
        original_text: original,
        machine_text: machine,
        final_text: final,
        approved: approved,
        originalText: original,
        translatedText: final,
      };
    });

    return {
      documentId: String(documentId),
      language: langCode,
      languageMeta: getLanguageByCode(langCode),
      status: (data.status || 'COMPLETED').toUpperCase(),
      completedAt: data.completedAt || data.updatedAt || new Date().toISOString(),
      sentenceCount: normalizedSentences.length,
      sentences: normalizedSentences,
    };
  },

  isMockMode() {
    return USE_MOCK;
  },
};

export default translationService;
