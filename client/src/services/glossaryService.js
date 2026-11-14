import api from './api';

/**
 * Glossary Service
 *
 * Implements client-side IPR terminology management conforming to Person A's API:
 * 1. GET /glossary (Any authenticated user)
 *    Retrieves dictionary of IPR source terms and regional translations.
 *
 * 2. POST /glossary (Admin only)
 *    Body: { "term": "Patent", "translations": { "hi": "पेटेंट", ... } }
 *
 * 3. DELETE /glossary (Admin only)
 *    Params / query or body: identifies entry by id or term
 *
 * In Mock Mode (default when VITE_USE_MOCK_GLOSSARY !== 'false'):
 * - Realistic curated dataset of essential IPR terms across the 6 regional Indian languages.
 * - Simulates network latency.
 * - Persists additions and deletions across browser refreshes via localStorage.
 * - Enforces role-based permissions in the UI layer.
 */

const USE_MOCK = import.meta.env.VITE_USE_MOCK_GLOSSARY !== 'false';
const MOCK_GLOSSARY_STORAGE_KEY = 'cipam_mock_glossary_db';

// Initial realistic core IPR terminology database
const INITIAL_MOCK_GLOSSARY = [
  {
    id: 'glo_1',
    term: 'Intellectual Property',
    category: 'General IPR',
    definition: 'Creations of the human intellect protected by law.',
    translations: {
      hi: 'बौद्धिक संपदा',
      mr: 'बौद्धिक संपदा',
      bn: 'বুদ্ধিবৃত্তিক সম্পত্তি',
      gu: 'બૌદ્ધિક સંપદા',
      ta: 'அறிவுசார் சொத்து',
      te: 'మేధో సంపత్తి',
    },
    createdAt: '2026-11-01T10:00:00.000Z',
    createdBy: 'CIPAM Admin',
  },
  {
    id: 'glo_2',
    term: 'Patent',
    category: 'Industrial Property',
    definition: 'Exclusive legal right granted for an invention for a limited period.',
    translations: {
      hi: 'पेटेंट',
      mr: 'पेटंट',
      bn: 'পেটেন্ট',
      gu: 'પેટન્ટ',
      ta: 'காப்புரிமை',
      te: 'పేటెంట్',
    },
    createdAt: '2026-11-01T10:05:00.000Z',
    createdBy: 'CIPAM Admin',
  },
  {
    id: 'glo_3',
    term: 'Trademark',
    category: 'Commercial Marks',
    definition: 'Distinctive sign or indicator used to distinguish goods/services.',
    translations: {
      hi: 'व्यापार चिह्न (ट्रेडमार्क)',
      mr: 'व्यापार चिन्ह (ट्रेडमार्क)',
      bn: 'ট্রেডমার্ক',
      gu: 'વેપાર ચિહ્ન (ટ્રેડમાર્ક)',
      ta: 'வர்த்தக முத்திரை',
      te: 'ట్రేడ్‌మార్క్',
    },
    createdAt: '2026-11-02T11:20:00.000Z',
    createdBy: 'CIPAM Admin',
  },
  {
    id: 'glo_4',
    term: 'Copyright',
    category: 'Literary & Artistic',
    definition: 'Legal right granted to the creator of original literary and artistic works.',
    translations: {
      hi: 'प्रतिलिप्यधिकार (कॉपीराइट)',
      mr: 'प्रतधिकार (कॉपीराइट)',
      bn: 'কপিরাইট',
      gu: 'કૉપિરાઇટ',
      ta: 'பதிப்புரிமை',
      te: 'కాపీరైట్',
    },
    createdAt: '2026-11-03T14:15:00.000Z',
    createdBy: 'CIPAM Admin',
  },
  {
    id: 'glo_5',
    term: 'Geographical Indication',
    category: 'Origin & Heritage',
    definition: 'Sign identifying goods as originating in a specific place possessing local qualities.',
    translations: {
      hi: 'भौगोलिक उपदर्शन (जीआई)',
      mr: 'भौगोलिक संकेत',
      bn: 'ভৌগোলিক নির্দেশক (জিআই)',
      gu: 'ભૌગોલિક સંકેત',
      ta: 'புவிசார் குறியீடு',
      te: 'భౌగోళిక సూచిక',
    },
    createdAt: '2026-11-04T09:30:00.000Z',
    createdBy: 'CIPAM Admin',
  },
  {
    id: 'glo_6',
    term: 'Industrial Design',
    category: 'Designs',
    definition: 'Ornamental or aesthetic aspect of an article of manufacture.',
    translations: {
      hi: 'औद्योगिक डिज़ाइन',
      mr: 'औद्योगिक रचना / डिझाइन',
      bn: 'শিল্প নকশা',
      gu: 'ઔદ્યોગિક ડિઝાઇન',
      ta: 'தொழில்துறை வடிவமைப்பு',
      te: 'పారిశ్రామిక నమూనా',
    },
    createdAt: '2026-11-05T16:45:00.000Z',
    createdBy: 'CIPAM Admin',
  },
  {
    id: 'glo_7',
    term: 'Trade Secret',
    category: 'Confidential Information',
    definition: 'Confidential business information providing an enterprise a competitive advantage.',
    translations: {
      hi: 'व्यापार रहस्य',
      mr: 'व्यापार गुपित',
      bn: 'বাণিজ্য গোপনীয়তা',
      gu: 'વેપાર રહસ્ય',
      ta: 'வணிக ரகசியம்',
      te: 'వాణిజ్య రహస్యం',
    },
    createdAt: '2026-11-06T12:00:00.000Z',
    createdBy: 'CIPAM Admin',
  },
  {
    id: 'glo_8',
    term: 'Infringement',
    category: 'Enforcement',
    definition: 'Unauthorized violation or breach of protected intellectual property rights.',
    translations: {
      hi: 'अतिलंघन / उल्लंघन',
      mr: 'उल्लंघन',
      bn: 'লঙ্ঘন',
      gu: 'ઉલ્લંઘન',
      ta: 'மீறல்',
      te: 'ఉల్లంఘన',
    },
    createdAt: '2026-11-07T15:10:00.000Z',
    createdBy: 'CIPAM Admin',
  },
  {
    id: 'glo_9',
    term: 'Licensing',
    category: 'Commercialization',
    definition: 'Legal partnership agreement granting permission to use an IPR asset under terms.',
    translations: {
      hi: 'अनुज्ञापन (लाइसेंसिंग)',
      mr: 'परवाना देणे (लायसन्सिंग)',
      bn: 'লাইসেন্সিং',
      gu: 'પરવાનો (લાયસન્સિંગ)',
      ta: 'உரிமம் வழங்குதல்',
      te: 'లైసెన్సింగ్',
    },
    createdAt: '2026-11-08T11:00:00.000Z',
    createdBy: 'CIPAM Admin',
  },
];

const getStoredGlossary = () => {
  try {
    const raw = localStorage.getItem(MOCK_GLOSSARY_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('Could not read mock glossary from localStorage', err);
  }
  try {
    localStorage.setItem(MOCK_GLOSSARY_STORAGE_KEY, JSON.stringify(INITIAL_MOCK_GLOSSARY));
  } catch {
    // ignore
  }
  return INITIAL_MOCK_GLOSSARY;
};

const saveStoredGlossary = (entries) => {
  try {
    localStorage.setItem(MOCK_GLOSSARY_STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    console.warn('Could not persist mock glossary to localStorage', err);
  }
};

const simulateDelay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

export const glossaryService = {
  /**
   * Fetch all glossary entries
   * Conforms to Person A: GET /glossary
   * @returns {Promise<Array>}
   */
  async getGlossary() {
    if (USE_MOCK) {
      await simulateDelay(250);
      const entries = getStoredGlossary();
      // Sort alphabetically by English term
      return entries.slice().sort((a, b) => a.term.localeCompare(b.term));
    }

    // Real API Mode: GET /glossary
    const response = await api.get('/glossary');
    return this.normalizeGlossaryList(response.data);
  },

  /**
   * Add a new glossary entry (Admin only)
   * Conforms to Person A: POST /glossary
   * @param {Object} entryData - { term, definition, category, translations: { hi, mr, bn, gu, ta, te } }
   * @param {Object} user - Current user object
   * @returns {Promise<Object>} Created entry
   */
  async addEntry(entryData, user = {}) {
    const cleanTerm = (entryData.term || '').trim();
    if (!cleanTerm) {
      throw new Error('English source term is required.');
    }

    if (USE_MOCK) {
      await simulateDelay(350);
      const entries = getStoredGlossary();

      // Check for duplicate term (case insensitive)
      if (entries.some((e) => e.term.toLowerCase() === cleanTerm.toLowerCase())) {
        throw new Error(`The term "${cleanTerm}" already exists in the glossary.`);
      }

      const newEntry = {
        id: `glo_${Date.now()}`,
        term: cleanTerm,
        category: (entryData.category || 'General IPR').trim(),
        definition: (entryData.definition || '').trim(),
        translations: entryData.translations || {},
        createdAt: new Date().toISOString(),
        createdBy: user?.name || user?.email || 'CIPAM Administrator',
      };

      const updated = [newEntry, ...entries];
      saveStoredGlossary(updated);
      return newEntry;
    }

    // Real API Mode: POST /glossary
    try {
      const response = await api.post('/glossary', {
        term: cleanTerm,
        category: entryData.category,
        definition: entryData.definition,
        translations: entryData.translations,
      });

      return this.normalizeGlossaryEntry(response.data?.entry || response.data);
    } catch (err) {
      if (err.response?.status === 403) {
        throw new Error('Access denied: Administrator permissions required to add glossary terms.');
      }
      throw err;
    }
  },

  /**
   * Delete a glossary entry (Admin only)
   * Conforms to Person A: DELETE /glossary
   * @param {string} entryId - Unique identifier of glossary record
   * @param {string} term - The English term
   * @returns {Promise<{ success: boolean, id: string }>}
   */
  async deleteEntry(entryId, term) {
    if (!entryId) {
      throw new Error('Entry identifier is required for deletion.');
    }

    if (USE_MOCK) {
      await simulateDelay(300);
      const entries = getStoredGlossary();
      const updated = entries.filter((e) => e.id !== entryId);
      if (updated.length === entries.length) {
        throw new Error(`Term with ID "${entryId}" was not found.`);
      }
      saveStoredGlossary(updated);
      return { success: true, id: entryId, term };
    }

    // Real API Mode: DELETE /glossary
    try {
      // Handles either query parameter or request body as per Person A backend implementation
      const response = await api.delete('/glossary', {
        params: { id: entryId, term },
        data: { id: entryId, term },
      });

      return response.data || { success: true, id: entryId };
    } catch (err) {
      if (err.response?.status === 403) {
        throw new Error('Access denied: Administrator permissions required to delete glossary terms.');
      }
      throw err;
    }
  },

  /**
   * Normalize an array of glossary entries from various backend shapes
   */
  normalizeGlossaryList(rawResponse) {
    const list =
      rawResponse?.glossary ||
      rawResponse?.terms ||
      rawResponse?.data ||
      (Array.isArray(rawResponse) ? rawResponse : []);

    return list.map((item, idx) => this.normalizeGlossaryEntry(item, idx));
  },

  /**
   * Normalize a single entry
   */
  normalizeGlossaryEntry(item, fallbackIdx = 0) {
    return {
      id: String(item.id || item._id || `glo_${fallbackIdx + 1}`),
      term: item.term || item.english || item.source_term || 'Untitled Term',
      category: item.category || 'General IPR',
      definition: item.definition || '',
      translations: item.translations || {
        hi: item.hi || item.hindi || '',
        mr: item.mr || item.marathi || '',
        bn: item.bn || item.bengali || '',
        gu: item.gu || item.gujarati || '',
        ta: item.ta || item.tamil || '',
        te: item.te || item.telugu || '',
      },
      createdAt: item.created_at || item.createdAt || new Date().toISOString(),
      createdBy: item.created_by || item.createdBy || 'System',
    };
  },

  isMockMode() {
    return USE_MOCK;
  },
};

export default glossaryService;
