import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import MainLayout from '../components/MainLayout';
import documentService from '../services/documentService';
import translationService from '../services/translationService';
import { getLanguageByCode, SOURCE_LANGUAGE } from '../config/languages';

/**
 * Translation Workflow & Execution Screen:
 *
 * 1. Takes selected document and selected languages from route state (or restores from ID).
 * 2. Conforms to Person A's API contract:
 *    Initiates separate POST /documents/:id/translate { "lang": code } requests per language.
 * 3. Shows per-language independent status (NOT_STARTED | TRANSLATING | COMPLETED | FAILED).
 * 4. Allows individual retry of failed languages without repeating completed ones.
 * 5. Provides direct link to Results View as soon as one or more languages complete.
 */
export const TranslationWorkflow = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [document, setDocument] = useState(location.state?.document || null);
  const [docLoading, setDocLoading] = useState(!document);
  const [docError, setDocError] = useState(null);

  // Selected languages passed from LanguageSelection (or defaults to ['hi'] if direct link)
  const [selectedLangs, setSelectedLangs] = useState(
    location.state?.languages || ['hi']
  );

  // Per-language status state:
  // { [langCode]: { status: 'NOT_STARTED' | 'TRANSLATING' | 'COMPLETED' | 'FAILED', error: string | null, result: Object | null } }
  const [langStates, setLangStates] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const hasTriggeredInitialRun = useRef(false);

  // 1. Fetch document if not passed in location state
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

  // 2. Initialize language status map
  useEffect(() => {
    const initialMap = {};
    selectedLangs.forEach((code) => {
      initialMap[code] = {
        status: 'NOT_STARTED',
        error: null,
        result: null,
      };
    });
    setLangStates(initialMap);
  }, [selectedLangs]);

  // 3. Translate a single language (conforms to POST /documents/:id/translate { lang: code })
  const translateSingleLanguage = useCallback(
    async (langCode) => {
      setLangStates((prev) => ({
        ...prev,
        [langCode]: {
          ...(prev[langCode] || {}),
          status: 'TRANSLATING',
          error: null,
        },
      }));

      try {
        const result = await translationService.translateDocument(id, langCode);
        setLangStates((prev) => ({
          ...prev,
          [langCode]: {
            status: 'COMPLETED',
            error: null,
            result,
          },
        }));
        return { success: true, langCode, result };
      } catch (err) {
        setLangStates((prev) => ({
          ...prev,
          [langCode]: {
            status: 'FAILED',
            error: err.message || 'Translation request failed.',
            result: null,
          },
        }));
        return { success: false, langCode, error: err };
      }
    },
    [id]
  );

  // 4. Batch trigger translation sequence (calling single endpoint per language)
  const runAllTranslations = useCallback(
    async (languagesToRun) => {
      if (!languagesToRun || languagesToRun.length === 0) return;
      setIsProcessing(true);

      // Execute each language request independently so progress is displayed live
      for (const code of languagesToRun) {
        await translateSingleLanguage(code);
      }

      setIsProcessing(false);
    },
    [translateSingleLanguage]
  );

  // 5. Trigger initial translation run once document is loaded
  useEffect(() => {
    if (!document || hasTriggeredInitialRun.current) return;
    hasTriggeredInitialRun.current = true;
    runAllTranslations(selectedLangs);
  }, [document, selectedLangs, runAllTranslations]);

  // Retry an individual failed language
  const handleRetryLanguage = (langCode) => {
    translateSingleLanguage(langCode);
  };

  // View results
  const handleViewResults = () => {
    const completedLanguages = Object.keys(langStates).filter(
      (code) => langStates[code]?.status === 'COMPLETED'
    );
    navigate(`/documents/${id}/results`, {
      state: {
        document,
        languages: completedLanguages.length > 0 ? completedLanguages : selectedLangs,
        activeLanguage: completedLanguages[0] || selectedLangs[0],
      },
    });
  };

  const completedCount = Object.values(langStates).filter(
    (s) => s.status === 'COMPLETED'
  ).length;
  const failedCount = Object.values(langStates).filter(
    (s) => s.status === 'FAILED'
  ).length;
  const inProgressCount = Object.values(langStates).filter(
    (s) => s.status === 'TRANSLATING'
  ).length;
  const totalCount = selectedLangs.length;

  return (
    <MainLayout
      pageTitle="Translation Pipeline"
      pageDescription="Executing sentence-level contextual translation into designated regional Indian languages."
      actions={
        <Link to={`/documents/${id}/languages`} className="btn btn-secondary btn-sm">
          &larr; Back to Language Selection
        </Link>
      }
    >
      {docLoading ? (
        <div className="dashboard-card state-panel">
          <div className="auth-spinner" aria-hidden="true"></div>
          <p>Initializing translation context...</p>
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
        <div className="workflow-container">
          {/* Header Summary Card */}
          <div className="dashboard-card doc-context-card">
            <div className="context-card-left">
              <span className="context-pill">Document in Progress</span>
              <h2 className="context-doc-name">{document.name}</h2>
              <div className="context-meta">
                <span>Source: <strong>{SOURCE_LANGUAGE.name}</strong></span>
                <span className="dot-sep">&bull;</span>
                <span>Format: <strong>{document.fileType?.toUpperCase()}</strong></span>
                <span className="dot-sep">&bull;</span>
                <span>Target Languages: <strong>{totalCount}</strong></span>
              </div>
            </div>

            <div className="context-card-right">
              <div className="pipeline-progress-box">
                <span className="pipeline-count-label">
                  {completedCount} of {totalCount} Completed
                </span>
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Language Status Rows */}
          <div className="dashboard-card workflow-status-list">
            <div className="card-header-bar">
              <div>
                <h3 className="card-section-title">Language Pipeline Status</h3>
                <p className="card-section-sub">
                  Each language initiates an independent request via <code>POST /documents/:id/translate</code>.
                </p>
              </div>

              {completedCount > 0 && (
                <button
                  type="button"
                  onClick={handleViewResults}
                  className="btn btn-primary btn-sm"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  View Translation Results &rarr;
                </button>
              )}
            </div>

            <div className="lang-status-items">
              {selectedLangs.map((code) => {
                const lang = getLanguageByCode(code);
                const state = langStates[code] || { status: 'NOT_STARTED' };

                return (
                  <div key={code} className={`status-row status-row-${state.status.toLowerCase()}`}>
                    <div className="status-row-lang">
                      <span className="status-lang-native">{lang?.nativeName}</span>
                      <span className="status-lang-english">{lang?.name} ({code.toUpperCase()})</span>
                    </div>

                    <div className="status-row-state">
                      {state.status === 'TRANSLATING' && (
                        <div className="state-badge-wrap state-translating">
                          <span className="btn-spinner inline-spinner" aria-hidden="true" />
                          <span>Translating sentences...</span>
                        </div>
                      )}

                      {state.status === 'COMPLETED' && (
                        <div className="state-badge-wrap state-completed">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>Completed ({state.result?.sentenceCount || 5} sentences)</span>
                        </div>
                      )}

                      {state.status === 'FAILED' && (
                        <div className="state-badge-wrap state-failed">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>{state.error || 'Translation failed.'}</span>
                        </div>
                      )}

                      {state.status === 'NOT_STARTED' && (
                        <div className="state-badge-wrap state-queued">
                          <span>Queued</span>
                        </div>
                      )}
                    </div>

                    <div className="status-row-actions">
                      {state.status === 'FAILED' && (
                        <button
                          type="button"
                          onClick={() => handleRetryLanguage(code)}
                          className="btn btn-secondary btn-xs"
                          disabled={isProcessing}
                        >
                          Retry
                        </button>
                      )}

                      {state.status === 'COMPLETED' && (
                        <button
                          type="button"
                          onClick={() => {
                            navigate(`/documents/${id}/results`, {
                              state: {
                                document,
                                languages: selectedLangs,
                                activeLanguage: code,
                              },
                            });
                          }}
                          className="btn btn-secondary btn-xs"
                        >
                          Inspect Sentences
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div className="workflow-bottom-bar">
              <div className="workflow-summary-stats">
                {isProcessing ? (
                  <span className="summary-text-progress">Processing {inProgressCount} active request(s)...</span>
                ) : completedCount === totalCount ? (
                  <span className="summary-text-success">All {totalCount} language translations completed successfully.</span>
                ) : failedCount > 0 ? (
                  <span className="summary-text-warn">{failedCount} language translation(s) encountered an issue.</span>
                ) : (
                  <span>Ready to view results.</span>
                )}
              </div>

              <div className="workflow-btn-group">
                <Link to={`/documents/${id}/languages`} className="btn btn-secondary">
                  Adjust Languages
                </Link>
                {completedCount > 0 && (
                  <button
                    type="button"
                    onClick={handleViewResults}
                    className="btn btn-primary"
                  >
                    View Translation Results ({completedCount})
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </MainLayout>
  );
};

export default TranslationWorkflow;
