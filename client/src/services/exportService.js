import api from './api';
import { isValidLanguageCode, getLanguageByCode } from '../config/languages';

/**
 * Export Service
 *
 * Implements client-side export workflow conforming to Person A's API contract:
 * GET /documents/:id/export?lang=hi&format=docx
 *
 * Supported formats:
 * - 'docx': Microsoft Word (.docx)
 * - 'pdf':  Portable Document Format (.pdf)
 *
 * In Real API Mode:
 * - Requests binary response via responseType: 'blob'.
 * - Preserves withCredentials: true (HTTP-only cookies).
 * - Extracts filename from Content-Disposition header if available.
 * - Triggers browser download cleanly and revokes temporary object URLs.
 * - Handles JSON error payloads nested inside Blob errors gracefully.
 *
 * In Mock Mode (default when VITE_USE_MOCK_EXPORTS !== 'false'):
 * - Simulates asynchronous processing delay.
 * - Transparently informs the user that mock mode simulates the export flow,
 *   without generating fake DOCX/PDF content or pretending a translated binary file was received.
 */

const USE_MOCK = import.meta.env.VITE_USE_MOCK_EXPORTS !== 'false';

export const SUPPORTED_EXPORT_FORMATS = ['docx', 'pdf'];

export const exportService = {
  /**
   * Validate parameters before export
   */
  validateExportParams(documentId, langCode, format) {
    if (!documentId) {
      throw new Error('Valid document identifier is required for export.');
    }
    if (!langCode || !isValidLanguageCode(langCode)) {
      throw new Error(`Unsupported target language code "${langCode}".`);
    }
    const cleanFormat = (format || '').toLowerCase();
    if (!SUPPORTED_EXPORT_FORMATS.includes(cleanFormat)) {
      throw new Error(`Unsupported export format "${format}". Supported formats: docx, pdf.`);
    }
    return { documentId, langCode, format: cleanFormat };
  },

  /**
   * Helper to extract filename from Content-Disposition header
   */
  extractFilename(contentDisposition, fallbackFilename) {
    if (contentDisposition) {
      // Try filename* (RFC 5987) first: filename*=UTF-8''filename.ext
      const rfc5987Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
      if (rfc5987Match && rfc5987Match[1]) {
        try {
          return decodeURIComponent(rfc5987Match[1]);
        } catch {
          // fallback
        }
      }
      // Standard filename="filename.ext" or filename=filename.ext
      const standardMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      if (standardMatch && standardMatch[1]) {
        return standardMatch[1].trim();
      }
    }
    return fallbackFilename;
  },

  /**
   * Construct a clean, safe fallback filename
   */
  constructFallbackFilename(docName, langCode, format) {
    const baseName = (docName || 'translated_document')
      .replace(/\.[^/.]+$/, '') // strip original extension
      .replace(/[^a-zA-Z0-9_-]/g, '_'); // sanitize special characters
    return `${baseName}_${langCode}.${format}`;
  },

  /**
   * Trigger actual browser download from Blob and cleanup memory
   */
  triggerBlobDownload(blob, filename) {
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Cleanup temporary object URL after brief delay
    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
    }, 1500);
  },

  /**
   * Request document export
   * @param {string} documentId
   * @param {string} langCode
   * @param {string} format ('docx' | 'pdf')
   * @param {Object} options - { docName: string, unapprovedCount: number }
   * @returns {Promise<{ success: boolean, filename: string, isMock: boolean, format: string }>}
   */
  async exportDocument(documentId, langCode, format, options = {}) {
    const valid = this.validateExportParams(documentId, langCode, format);
    const fallbackFilename = this.constructFallbackFilename(
      options.docName,
      valid.langCode,
      valid.format
    );

    if (USE_MOCK) {
      // Simulate network request delay (800ms)
      await new Promise((resolve) => setTimeout(resolve, 800));

      return {
        success: true,
        filename: fallbackFilename,
        isMock: true,
        format: valid.format,
        message: `[Mock Mode] Export workflow for ${valid.format.toUpperCase()} (${valid.langCode}) completed successfully. In production, Person B's service generates the downloadable binary file.`,
      };
    }

    // Real API Mode: GET /documents/:id/export?lang=hi&format=docx
    try {
      const response = await api.get(`/documents/${valid.documentId}/export`, {
        params: {
          lang: valid.langCode,
          format: valid.format,
        },
        responseType: 'blob',
      });

      // Handle potential JSON error responses that arrive with status 200 or as blob
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        const textData = await response.data.text();
        const parsed = JSON.parse(textData);
        throw new Error(parsed.message || parsed.error || 'Export request failed on server.');
      }

      const contentDisposition = response.headers['content-disposition'];
      const finalFilename = this.extractFilename(contentDisposition, fallbackFilename);

      this.triggerBlobDownload(response.data, finalFilename);

      return {
        success: true,
        filename: finalFilename,
        isMock: false,
        format: valid.format,
        message: `${valid.format.toUpperCase()} document downloaded successfully as "${finalFilename}".`,
      };
    } catch (err) {
      // If error response is a blob containing JSON error details
      if (err.response?.data instanceof Blob) {
        try {
          const errorText = await err.response.data.text();
          const parsedError = JSON.parse(errorText);
          throw new Error(parsedError.message || parsedError.error || 'Export server error.');
        } catch (jsonErr) {
          // ignore parsing error and throw original message
        }
      }
      throw new Error(err.message || 'Export request failed. Please verify backend connection.');
    }
  },

  isMockMode() {
    return USE_MOCK;
  },
};

export default exportService;
