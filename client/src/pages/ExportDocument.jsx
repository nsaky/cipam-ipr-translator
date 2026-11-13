import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import MainLayout from '../components/MainLayout';
import documentService from '../services/documentService';
import translationService from '../services/translationService';
import exportService, { SUPPORTED_EXPORT_FORMATS } from '../services/exportService';
import { getLanguageByCode, SOURCE_LANGUAGE } from '../config/languages';

/**
 * ExportDocument Page
 *
 * Provides dedicated, validated export workflow for a document and target language:
 * - Shows document name, original type, target language, and review progress.
 * - Warns user clearly if translation has unapproved sentences.
 * - Enables DOCX and PDF export selection.
 * - Displays loading, success, and error feedback cleanly.
 * - Dispatches GET /documents/:id/export?lang=...&format=... via exportService.
 */
export const ExportDocument = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Read search params if available (e.g. ?lang=hi)
  const searchParams = new URLSearchParams(location.search);
  const paramLang = searchParams.get('lang');

  const [document, setDocument] = useState(location.state?.document || null);
  const [docLoading, setDocLoading] = useState(!document);
  const [docError, setDocError] = useState(null);

  // Available languages from location state or default to ['hi']
  const [availableLanguages, setAvailableLanguages] = useState(
    location.state?.languages || (paramLang ? [paramLang] : ['hi'])
  );
  const [selectedLangCode, setSelectedLangCode] = useState(
    location.state?.activeLanguage || paramLang || availableLanguages[0] || 'hi'
  );

  // Translation record & review stats
  const [translationData, setTranslationData] = useState(null);
  const [transLoading, setTransLoading] = useState(true);
  const [transError, setTransError] = useState(null);

  // Selected format ('docx' | 'pdf')
  const [selectedFormat, setSelectedFormat] = useState('docx');

  // Export operation state
  const [isExporting, setIsExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState(null); // { type: 'success'|'error'|'info', text: string }

  // 1. Fetch document if not passed in state
  useEffect(() => {
    if (document) return;
    let isMounted = true;
    const fetchDoc = async () => {
      try {
        setDocLoading(true);
        const fetched = await documentService.getDocumentById(id);
        if (isMounted) setDocument(fetched);
      } catch (err) {
        if (isMounted) setDocError(err.message || 'Could not locate document.');
      } finally {
        if (isMounted) setDocLoading(false);
      }
    };
    fetchDoc();
    return () => {
      isMounted = false;
    };
  }, [id, document]);

  // 2. Fetch translations & sentences for selected language to calculate approval metrics
  useEffect(() => {
    let isMounted = true;
    const fetchTrans = async () => {
      try {
        setTransLoading(true);
        setTransError(null);
        const data = await translationService.getTranslations(id, selectedLangCode);
        if (isMounted) setTranslationData(data);
      } catch (err) {
        if (isMounted) setTransError(err.message || 'Failed to retrieve translation details.');
      } finally {
        if (isMounted) setTransLoading(false);
      }
    };
    fetchTrans();
    return () => {
      isMounted = false;
    };
  }, [id, selectedLangCode]);

  const activeLangMeta = getLanguageByCode(selectedLangCode);
  const sentences = translationData?.sentences || [];
  const reviewStats = translationService.calculateReviewStats(sentences);

  const handleTriggerExport = async () => {
    if (isExporting || !document) return;
    setExportFeedback(null);
    setIsExporting(true);

    try {
      const result = await exportService.exportDocument(
        id,
        selectedLangCode,
        selectedFormat,
        {
          docName: document.name,
          unapprovedCount: reviewStats.pendingCount,
        }
      );

      setExportFeedback({
        type: 'success',
        text: result.message,
        isMock: result.isMock,
        format: result.format,
      });
    } catch (err) {
      setExportFeedback({
        type: 'error',
        text: err.message || 'Export request failed. Please try again.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <MainLayout
      pageTitle="Export & Download Translation"
      pageDescription="Generate publication-ready DOCX or PDF documents with verified regional IPR translations."
      actions={
        <div className="header-action-group">
          <Link
            to={`/documents/${id}/results`}
            state={{ document, languages: availableLanguages, activeLanguage: selectedLangCode }}
            className="btn btn-secondary btn-sm"
          >
            &larr; Bilingual Results
          </Link>
          <Link
            to={`/documents/${id}/review`}
            state={{ document, languages: availableLanguages, activeLanguage: selectedLangCode }}
            className="btn btn-secondary btn-sm"
          >
            Review & Edit
          </Link>
          <Link to="/documents" className="btn btn-secondary btn-sm">
            All Documents
          </Link>
        </div>
      }
    >
      {docLoading ? (
        <div className="dashboard-card state-panel">
          <div className="auth-spinner" aria-hidden="true"></div>
          <p>Loading document context...</p>
        </div>
      ) : docError ? (
        <div className="dashboard-card">
          <div className="alert alert-error">
            <span>{docError}</span>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <Link to="/documents" className="btn btn-secondary btn-sm">
              &larr; Return to Repository
            </Link>
          </div>
        </div>
      ) : document ? (
        <div className="export-container">
          {/* Header Context Card */}
          <div className="dashboard-card doc-context-card">
            <div className="context-card-left">
              <span className="context-pill">Export Preparation</span>
              <h2 className="context-doc-name">{document.name}</h2>
              <div className="context-meta">
                <span>Original Format: <strong>{document.fileType?.toUpperCase()}</strong></span>
                <span className="dot-sep">&bull;</span>
                <span>Source Language: <strong>{SOURCE_LANGUAGE.name}</strong></span>
                <span className="dot-sep">&bull;</span>
                <span>Active Target: <strong>{activeLangMeta?.name} ({activeLangMeta?.nativeName})</strong></span>
              </div>
            </div>

            <div className="context-card-right">
              {reviewStats.isAllApproved ? (
                <span className="status-pill status-completed">
                  100% Fully Approved
                </span>
              ) : (
                <span className="status-pill status-review">
                  {reviewStats.approvedCount}/{reviewStats.total} Approved
                </span>
              )}
            </div>
          </div>

          {/* Language Selection Bar if multiple languages available */}
          {availableLanguages.length > 1 && (
            <div className="language-tabs-bar">
              <div className="lang-tabs-list" role="tablist">
                {availableLanguages.map((code) => {
                  const lang = getLanguageByCode(code);
                  const isActive = code === selectedLangCode;
                  return (
                    <button
                      key={code}
                      role="tab"
                      aria-selected={isActive}
                      className={`lang-tab-btn ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedLangCode(code);
                        setExportFeedback(null);
                      }}
                      disabled={isExporting}
                    >
                      <span className="tab-native-name">{lang?.nativeName || code.toUpperCase()}</span>
                      <span className="tab-eng-name">{lang?.name}</span>
                    </button>
                  );
                })}
              </div>
              <div className="lang-tabs-meta">
                <span className="tabs-caption">Select language version to export</span>
              </div>
            </div>
          )}

          {/* Feedback Banners */}
          {exportFeedback && (
            <div
              className={`alert ${
                exportFeedback.type === 'success' ? 'alert-success' : 'alert-error'
              }`}
              role="alert"
            >
              <div className="alert-content-wrap">
                <strong>{exportFeedback.type === 'success' ? 'Export Notice:' : 'Export Error:'}</strong>
                <p>{exportFeedback.text}</p>
                {exportFeedback.isMock && (
                  <p className="mock-sub-notice">
                    <em>Notice: In mock development mode, the export workflow is simulated. Connecting to Person A's backend (VITE_USE_MOCK_EXPORTS=false) triggers live DOCX/PDF binary generation via Person B's service.</em>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Warning banner if translation has unapproved sentences */}
          {!transLoading && reviewStats.pendingCount > 0 && (
            <div className="alert alert-warning" role="alert">
              <svg className="alert-icon" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <strong>Incomplete Review Warning:</strong> {reviewStats.pendingCount} of {reviewStats.total} sentences
                in <strong>{activeLangMeta?.name}</strong> have not yet been approved by a human reviewer.
                You may still proceed with export, or return to{' '}
                <Link
                  to={`/documents/${id}/review`}
                  state={{ document, languages: availableLanguages, activeLanguage: selectedLangCode }}
                  className="alert-link"
                >
                  Sentence Review
                </Link>{' '}
                to approve pending translations.
              </div>
            </div>
          )}

          {/* Main Format Selection & Export Card */}
          <div className="dashboard-card export-options-card">
            <h3 className="card-section-title">Select Export Format</h3>
            <p className="card-section-sub">
              Choose the output format for the final translated document in {activeLangMeta?.name} ({activeLangMeta?.nativeName}).
            </p>

            <div className="format-selection-grid">
              {/* DOCX Card */}
              <div
                className={`format-card ${selectedFormat === 'docx' ? 'format-card-selected' : ''}`}
                onClick={() => !isExporting && setSelectedFormat('docx')}
                role="radio"
                aria-checked={selectedFormat === 'docx'}
                tabIndex={0}
              >
                <div className="format-card-icon docx-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                </div>
                <div className="format-card-body">
                  <div className="format-title-row">
                    <h4 className="format-name">Microsoft Word (.docx)</h4>
                    <span className="file-badge file-docx">DOCX</span>
                  </div>
                  <p className="format-desc">
                    Fully editable Word document preserving paragraph formatting, heading hierarchy, and bilingual sentence alignment.
                  </p>
                </div>
                <div className={`format-radio-circle ${selectedFormat === 'docx' ? 'checked' : ''}`}>
                  {selectedFormat === 'docx' && <span className="radio-inner-dot" />}
                </div>
              </div>

              {/* PDF Card */}
              <div
                className={`format-card ${selectedFormat === 'pdf' ? 'format-card-selected' : ''}`}
                onClick={() => !isExporting && setSelectedFormat('pdf')}
                role="radio"
                aria-checked={selectedFormat === 'pdf'}
                tabIndex={0}
              >
                <div className="format-card-icon pdf-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <path d="M10 12h4"></path>
                    <path d="M10 16h4"></path>
                  </svg>
                </div>
                <div className="format-card-body">
                  <div className="format-title-row">
                    <h4 className="format-name">Portable Document Format (.pdf)</h4>
                    <span className="file-badge file-pdf">PDF</span>
                  </div>
                  <p className="format-desc">
                    Publication-ready PDF with embedded regional Indic fonts for clear educational printing and dissemination.
                  </p>
                </div>
                <div className={`format-radio-circle ${selectedFormat === 'pdf' ? 'checked' : ''}`}>
                  {selectedFormat === 'pdf' && <span className="radio-inner-dot" />}
                </div>
              </div>
            </div>

            {/* Export Summary Table */}
            <div className="export-summary-box">
              <h4 className="summary-title">Export Specifications:</h4>
              <div className="summary-rows">
                <div className="summary-row">
                  <span className="sum-lbl">Target Document:</span>
                  <span className="sum-val">{document.name}</span>
                </div>
                <div className="summary-row">
                  <span className="sum-lbl">Target Language:</span>
                  <span className="sum-val">{activeLangMeta?.name} ({activeLangMeta?.nativeName})</span>
                </div>
                <div className="summary-row">
                  <span className="sum-lbl">Sentence Count:</span>
                  <span className="sum-val">{sentences.length} sentences</span>
                </div>
                <div className="summary-row">
                  <span className="sum-lbl">Approval Status:</span>
                  <span className="sum-val">
                    {reviewStats.approvedCount} approved, {reviewStats.pendingCount} unapproved
                  </span>
                </div>
                <div className="summary-row">
                  <span className="sum-lbl">Endpoint:</span>
                  <span className="sum-val">
                    <code>GET /documents/{id}/export?lang={selectedLangCode}&format={selectedFormat}</code>
                  </span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="export-actions-footer">
              <Link to="/documents" className="btn btn-secondary">
                Back to Documents
              </Link>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleTriggerExport}
                disabled={isExporting}
              >
                {isExporting ? (
                  <>
                    <span className="btn-spinner" aria-hidden="true" />
                    Generating {selectedFormat.toUpperCase()}...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Download {selectedFormat.toUpperCase()} File
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </MainLayout>
  );
};

export default ExportDocument;
