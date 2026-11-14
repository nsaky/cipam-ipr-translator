import api from './api';

/**
 * Document Service
 *
 * Supports dual-mode operation:
 * 1. Mock Mode (default when VITE_USE_MOCK_AUTH !== 'false' or backend unavailable):
 *    - Uses localStorage to persist documents across page refreshes.
 *    - Simulates realistic asynchronous network delays.
 *    - Calculates statistics dynamically.
 *
 * 2. Real API Mode (Person A Backend):
 *    - GET /documents
 *    - GET /documents/:id
 *    - POST /documents (multipart/form-data via Axios)
 */

const USE_MOCK = import.meta.env.VITE_USE_MOCK_AUTH !== 'false';
const MOCK_DOCS_KEY = 'cipam_mock_documents';

// Default initial realistic mock records
const INITIAL_MOCK_DOCUMENTS = [
  {
    id: 'doc_101',
    name: 'National_IPR_Policy_Framework_Overview.pdf',
    originalName: 'National_IPR_Policy_Framework_Overview.pdf',
    fileType: 'pdf',
    mimeType: 'application/pdf',
    fileSize: 2457600, // 2.34 MB
    uploadDate: '2026-11-10T10:15:00.000Z',
    status: 'COMPLETED', // 'UPLOADED' | 'PROCESSING' | 'PENDING_REVIEW' | 'COMPLETED'
    targetLanguages: ['hi', 'mr'],
    sentenceCount: 142,
    uploadedBy: 'Dr. Rajesh Kumar',
    description: 'Government summary document detailing Objectives 1 through 7 of the National IPR Policy.'
  },
  {
    id: 'doc_102',
    name: 'Patents_Filing_Guidelines_SME_Startups.docx',
    originalName: 'Patents_Filing_Guidelines_SME_Startups.docx',
    fileType: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 1548288, // 1.48 MB
    uploadDate: '2026-11-11T14:30:00.000Z',
    status: 'PENDING_REVIEW',
    targetLanguages: ['ta', 'te', 'gu'],
    sentenceCount: 88,
    uploadedBy: 'Mohammad Yasir Iqbal',
    description: 'Procedure and fee rebates for filing patent applications under expedited examination schemes.'
  },
  {
    id: 'doc_103',
    name: 'Geographical_Indications_Awareness_Flyer.png',
    originalName: 'Geographical_Indications_Awareness_Flyer.png',
    fileType: 'png',
    mimeType: 'image/png',
    fileSize: 3145728, // 3.00 MB
    uploadDate: '2026-11-12T09:05:00.000Z',
    status: 'UPLOADED',
    targetLanguages: ['bn'],
    sentenceCount: 24,
    uploadedBy: 'Priya Sharma',
    description: 'Infographic explaining GI tagging criteria for traditional agricultural produce.'
  },
  {
    id: 'doc_104',
    name: 'Copyright_Amendments_Digital_Media_Notes.docx',
    originalName: 'Copyright_Amendments_Digital_Media_Notes.docx',
    fileType: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 819200, // 800 KB
    uploadDate: '2026-11-12T16:45:00.000Z',
    status: 'UPLOADED',
    targetLanguages: ['hi'],
    sentenceCount: 56,
    uploadedBy: 'Mohammad Yasir Iqbal',
    description: 'Summary of safe harbour and digital reproduction clauses in educational institutions.'
  },
  {
    id: 'doc_105',
    name: 'Trademark_Classification_Schedule_Goods.pdf',
    originalName: 'Trademark_Classification_Schedule_Goods.pdf',
    fileType: 'pdf',
    mimeType: 'application/pdf',
    fileSize: 4194304, // 4.00 MB
    uploadDate: '2026-11-08T11:20:00.000Z',
    status: 'COMPLETED',
    targetLanguages: ['mr', 'gu', 'hi'],
    sentenceCount: 210,
    uploadedBy: 'Ananya Roy',
    description: 'Classification table for classes 1 through 34 of Nice classification translated for regional offices.'
  }
];

const getStoredDocuments = () => {
  try {
    const raw = localStorage.getItem(MOCK_DOCS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('Could not read mock documents from localStorage', err);
  }
  try {
    localStorage.setItem(MOCK_DOCS_KEY, JSON.stringify(INITIAL_MOCK_DOCUMENTS));
  } catch {
    // ignore storage write errors
  }
  return INITIAL_MOCK_DOCUMENTS;
};

const saveStoredDocuments = (docs) => {
  try {
    localStorage.setItem(MOCK_DOCS_KEY, JSON.stringify(docs));
  } catch (err) {
    console.warn('Could not persist mock documents to localStorage', err);
  }
};

const simulateDelay = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));

export const documentService = {
  /**
   * Fetch all documents
   * @returns {Promise<Array>} List of document objects
   */
  async getDocuments() {
    if (USE_MOCK) {
      await simulateDelay(300);
      const docs = getStoredDocuments();
      // Sort newest upload date first by default
      return docs.slice().sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
    }

    const response = await api.get('/documents');
    // Normalize backend response if wrapped in { data: [...] } or { documents: [...] }
    return response.data?.documents || response.data?.data || response.data;
  },

  /**
   * Fetch a single document by its ID
   * @param {string} id
   * @returns {Promise<Object>} Document object
   */
  async getDocumentById(id) {
    if (USE_MOCK) {
      await simulateDelay(250);
      const docs = getStoredDocuments();
      const found = docs.find((d) => d.id === String(id));
      if (!found) {
        throw new Error(`Document with ID "${id}" was not found.`);
      }
      return found;
    }

    const response = await api.get(`/documents/${id}`);
    return response.data?.document || response.data?.data || response.data;
  },

  /**
   * Upload a new document
   * @param {File} file - Validated browser File object
   * @param {Object} metadata - Optional extra fields (e.g. description)
   * @returns {Promise<Object>} Newly created document record
   */
  async uploadDocument(file, metadata = {}) {
    if (USE_MOCK) {
      await simulateDelay(600);

      // Determine extension from file name
      const extMatch = file.name.match(/\.([0-9a-z]+)$/i);
      const extension = extMatch ? extMatch[1].toLowerCase() : 'unknown';

      const newDoc = {
        id: `doc_${Date.now()}`,
        name: file.name,
        originalName: file.name,
        fileType: extension,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        uploadDate: new Date().toISOString(),
        status: 'UPLOADED',
        targetLanguages: [],
        sentenceCount: null, // Will be extracted by Person B in Part 3
        uploadedBy: metadata.uploadedBy || 'Current User',
        description: metadata.description || 'Uploaded educational material awaiting language selection.',
      };

      const docs = getStoredDocuments();
      const updated = [newDoc, ...docs];
      saveStoredDocuments(updated);

      return newDoc;
    }

    // Real API Mode: Send multipart/form-data via Axios
    // Note: Do NOT set Content-Type manually, browser sets boundary automatically
    const formData = new FormData();
    formData.append('document', file);
    if (metadata.description) {
      formData.append('description', metadata.description);
    }

    const response = await api.post('/documents', formData);
    return response.data?.document || response.data?.data || response.data;
  },

  /**
   * Compute dashboard stats dynamically from document list
   * @param {Array} documents
   */
  calculateStats(documents = []) {
    const total = documents.length;
    const completed = documents.filter((d) => d.status === 'COMPLETED').length;
    // Awaiting translation includes newly uploaded docs and those in pending review
    const awaitingTranslation = documents.filter(
      (d) => d.status === 'UPLOADED' || d.status === 'PENDING_REVIEW'
    ).length;

    // Recently uploaded within the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentUploads = documents.filter(
      (d) => new Date(d.uploadDate) >= sevenDaysAgo
    ).length;

    return {
      total,
      recentUploads,
      awaitingTranslation,
      completed,
    };
  },

  /**
   * Helper to format bytes to human readable string (KB / MB)
   */
  formatFileSize(bytes) {
    if (!bytes || isNaN(bytes)) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  },

  /**
   * Helper to format ISO date strings
   */
  formatDate(isoString) {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  },

  /**
   * Check if mock mode is active
   */
  isMockMode() {
    return USE_MOCK;
  }
};

export default documentService;

