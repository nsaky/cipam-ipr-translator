import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import MainLayout from '../components/MainLayout';
import SentenceReviewCard from '../components/SentenceReviewCard';
import documentService from '../services/documentService';
import translationService from '../services/translationService';
import { getLanguageByCode, SOURCE_LANGUAGE } from '../config/languages';

/**
 * TranslationReview Screen
 *
 * Implements complete Part 4 Review & Editing workflow:
 * - Load document and sentence records for active language.
 * - Calculate review and approval statistics dynamically.
 * - Filter sentences (All, Awaiting Review, Approved).
 * - Navigation between sentences (Scroll into view / Previous / Next).
 * - Multi-language switching while maintaining independent states.
 * - Unsaved changes guard before navigating away.
 */
export const TranslationReview = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [document, setDocument] = useState(location.state?.document || null);
  const [docLoading, setDocLoading] = useState(!document);
  const [docError, setDocError] = useState(null);

  // Available languages for this document
  const [availableLanguages, setAvailableLanguages] = useState(
    location.state?.languages || ['hi']
  );

  // Active language being reviewed
  const [activeLangCode, setActiveLangCode] = useState(
    location.state?.activeLanguage || location.state?.languages?.[0] || 'hi'
  );

  // Translation record & sentences
  const [translationData, setTranslationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter & Navigation states
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'PENDING' | 'APPROVED'
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(0);

  // Track unsaved sentence IDs: Set of sentence IDs that currently have unsaved changes
  const [unsavedSentenceIds, setUnsavedSentenceIds] = useState(new Set());
  const [pendingNavigation, setPendingNavigation] = useState(null); // { type: 'route'|'lang'|'sentence', target: any }

  // Operation loading state maps
  const [savingMap, setSavingMap] = useState({});
  const [approvingMap, setApprovingMap] = useState({});
  const [globalBanner, setGlobalBanner] = useState(null);

  const hasUnsavedChanges = unsavedSentenceIds.size > 0;

  // Browser refresh/close protection (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (unsavedSentenceIds.size > 0) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [unsavedSentenceIds]);

  // Callback from SentenceReviewCard when a sentence's text changes
  const handleSentenceUnsavedChange = useCallback((sentenceId, isDirty) => {
    setUnsavedSentenceIds((prev) => {
      const next = new Set(prev);
      if (isDirty) {
        next.add(sentenceId);
      } else {
        next.delete(sentenceId);
      }
      return next;
    });
  }, []);

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

  // 2. Fetch translations for active language
  const loadTranslations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await translationService.getTranslations(id, activeLangCode);
      setTranslationData(data);
    } catch (err) {
      setError(err.message || `Failed to load translations for ${activeLangCode}.`);
    } finally {
      setLoading(false);
    }
  }, [id, activeLangCode]);

  useEffect(() => {
    loadTranslations();
  }, [loadTranslations]);

  const activeLangMeta = getLanguageByCode(activeLangCode);
  const sentences = translationData?.sentences || [];
  const stats = translationService.calculateReviewStats(sentences);

  // 3. Handle saving an individual sentence (PATCH /translations/:id { final_text })
  const handleSaveSentence = async (translationId, finalText) => {
    setSavingMap((prev) => ({ ...prev, [translationId]: true }));
    try {
      await translationService.updateFinalText(translationId, finalText, {
        documentId: id,
        langCode: activeLangCode,
      });

      // Update local state without full reload
      setTranslationData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sentences: prev.sentences.map((s) => {
            if (s.id === translationId) {
              return {
                ...s,
                final_text: finalText,
                translatedText: finalText,
                approved: false, // Re-review triggered
              };
            }
            return s;
          }),
        };
      });

      // Clear unsaved tracking for this sentence upon successful save
      setUnsavedSentenceIds((prev) => {
        const next = new Set(prev);
        next.delete(translationId);
        return next;
      });

      setGlobalBanner({
        type: 'success',
        text: 'Translation saved successfully. Sentence is marked for review.',
      });
      setTimeout(() => setGlobalBanner(null), 3500);
    } catch (err) {
      throw err;
    } finally {
      setSavingMap((prev) => ({ ...prev, [translationId]: false }));
    }
  };

  // 4. Handle sentence approval (PATCH /translations/:id { approved: true })
  const handleApproveSentence = async (translationId) => {
    setApprovingMap((prev) => ({ ...prev, [translationId]: true }));
    try {
      await translationService.updateApprovalStatus(translationId, true);

      setTranslationData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sentences: prev.sentences.map((s) => {
            if (s.id === translationId) {
              return { ...s, approved: true };
            }
            return s;
          }),
        };
      });

      setGlobalBanner({
        type: 'success',
        text: 'Sentence marked as approved.',
      });
      setTimeout(() => setGlobalBanner(null), 3000);
    } catch (err) {
      throw err;
    } finally {
      setApprovingMap((prev) => ({ ...prev, [translationId]: false }));
    }
  };

  // 5. Handle reopening an approved sentence (PATCH /translations/:id { approved: false })
  const handleReopenSentence = async (translationId) => {
    setApprovingMap((prev) => ({ ...prev, [translationId]: true }));
    try {
      await translationService.updateApprovalStatus(translationId, false);

      setTranslationData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sentences: prev.sentences.map((s) => {
            if (s.id === translationId) {
              return { ...s, approved: false };
            }
            return s;
          }),
        };
      });

      setGlobalBanner({
        type: 'info',
        text: 'Sentence reopened for review.',
      });
      setTimeout(() => setGlobalBanner(null), 3000);
    } catch (err) {
      throw err;
    } finally {
      setApprovingMap((prev) => ({ ...prev, [translationId]: false }));
    }
  };

  // Filtered sentences based on review filter
  const displayedSentences = sentences.filter((s) => {
    if (filterMode === 'PENDING') return s.approved !== true;
    if (filterMode === 'APPROVED') return s.approved === true;
    return true;
  });

  const scrollToSentence = (idx) => {
    setActiveSentenceIndex(idx);
    const el = window.document.getElementById(`sentence-${idx + 1}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Safe navigation interceptors
  const handleRequestNavigateRoute = (toPath, stateObj) => {
    if (hasUnsavedChanges) {
      setPendingNavigation({ type: 'route', to: toPath, state: stateObj });
      return;
    }
    navigate(toPath, { state: stateObj });
  };

  const handleRequestChangeLanguage = (targetLangCode) => {
    if (targetLangCode === activeLangCode) return;
    if (hasUnsavedChanges) {
      setPendingNavigation({ type: 'lang', code: targetLangCode });
      return;
    }
    setActiveLangCode(targetLangCode);
  };

  const handleRequestSentenceNav = (targetIndex) => {
    if (hasUnsavedChanges) {
      setPendingNavigation({ type: 'sentence', index: targetIndex });
      return;
    }
    scrollToSentence(targetIndex);
  };

  // Modal actions: Stay or Leave
  const handleStayOnPage = () => {
    setPendingNavigation(null);
  };

  const handleConfirmLeave = () => {
    const nav = pendingNavigation;
    setPendingNavigation(null);
    setUnsavedSentenceIds(new Set()); // discard unsaved warnings

    if (!nav) return;

    if (nav.type === 'route') {
      navigate(nav.to, { state: nav.state });
    } else if (nav.type === 'lang') {
      setActiveLangCode(nav.code);
    } else if (nav.type === 'sentence') {
      scrollToSentence(nav.index);
    }
  };

  return (
    <MainLayout
      pageTitle="Sentence-by-Sentence Translation Review"
      pageDescription="Refine contextual terminology, rectify translations, and approve final regional educational text."
      actions={
        <div className="header-action-group">
          <button
            type="button"
            onClick={() =>
              handleRequestNavigateRoute(`/documents/${id}/results`, {
                document,
                languages: availableLanguages,
                activeLanguage: activeLangCode,
              })
            }
            className="btn btn-secondary btn-sm"
          >
            &larr; Bilingual Results View
          </button>
          <button
            type="button"
            onClick={() => handleRequestNavigateRoute('/documents')}
            className="btn btn-secondary btn-sm"
          >
            All Documents
          </button>
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
        <div className="review-container">
          {/* Top Document Summary & Progress Strip */}
          <div className="dashboard-card doc-context-card">
            <div className="context-card-left">
              <span className="context-pill">Review & Editorial Workspace</span>
              <h2 className="context-doc-name">{document.name}</h2>
              <div className="context-meta">
                <span>Source: <strong>{SOURCE_LANGUAGE.name}</strong></span>
                <span className="dot-sep">&bull;</span>
                <span>Active Language: <strong>{activeLangMeta?.name} ({activeLangMeta?.nativeName})</strong></span>
                <span className="dot-sep">&bull;</span>
                <span>Total Sentences: <strong>{stats.total}</strong></span>
              </div>
            </div>

            <div className="context-card-right">
              <div className="review-progress-overview">
                <div className="review-progress-metrics">
                  <div className="metric-col">
                    <span className="metric-val text-success">{stats.approvedCount}</span>
                    <span className="metric-lbl">Approved</span>
                  </div>
                  <div className="metric-sep">/</div>
                  <div className="metric-col">
                    <span className="metric-val text-pending">{stats.pendingCount}</span>
                    <span className="metric-lbl">Pending Review</span>
                  </div>
                  <div className="metric-sep">/</div>
                  <div className="metric-col">
                    <span className="metric-val">{stats.progressPercent}%</span>
                    <span className="metric-lbl">Progress</span>
                  </div>
                </div>

                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${stats.progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Language Selection Tabs */}
          <div className="language-tabs-bar">
            <div className="lang-tabs-list" role="tablist">
              {availableLanguages.map((code) => {
                const lang = getLanguageByCode(code);
                const isActive = code === activeLangCode;
                return (
                  <button
                    key={code}
                    role="tab"
                    aria-selected={isActive}
                    className={`lang-tab-btn ${isActive ? 'active' : ''}`}
                    onClick={() => handleRequestChangeLanguage(code)}
                  >
                    <span className="tab-native-name">{lang?.nativeName || code.toUpperCase()}</span>
                    <span className="tab-eng-name">{lang?.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="lang-tabs-meta">
              <span className="tabs-caption">Reviewing: {activeLangMeta?.name}</span>
            </div>
          </div>

          {/* Feedback Toast Banner */}
          {globalBanner && (
            <div
              className={`alert ${globalBanner.type === 'success' ? 'alert-success' : 'alert-info'}`}
              role="alert"
            >
              <span>{globalBanner.text}</span>
            </div>
          )}

          {/* Sentence Filter and Quick Navigation Toolbar */}
          <div className="dashboard-card review-toolbar-card">
            <div className="toolbar-left">
              <span className="toolbar-label">Filter View:</span>
              <div className="filter-button-group">
                <button
                  type="button"
                  className={`btn btn-xs ${filterMode === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFilterMode('ALL')}
                >
                  All ({stats.total})
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${filterMode === 'PENDING' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFilterMode('PENDING')}
                >
                  Awaiting Review ({stats.pendingCount})
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${filterMode === 'APPROVED' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFilterMode('APPROVED')}
                >
                  Approved ({stats.approvedCount})
                </button>
              </div>
            </div>

            <div className="toolbar-right">
              {stats.isAllApproved ? (
                <div className="all-approved-badge">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>All Sentences Approved for {activeLangMeta?.name}</span>
                </div>
              ) : (
                <span className="pending-notice">
                  {stats.pendingCount} sentence(s) remaining for complete verification.
                </span>
              )}
            </div>
          </div>

          {/* Sentence Cards List */}
          {loading ? (
            <div className="dashboard-card state-panel">
              <div className="auth-spinner" aria-hidden="true"></div>
              <p>Loading {activeLangMeta?.name} sentences...</p>
            </div>
          ) : error ? (
            <div className="dashboard-card">
              <div className="alert alert-error">
                <span>{error}</span>
              </div>
            </div>
          ) : displayedSentences.length === 0 ? (
            <div className="dashboard-card state-panel empty-state">
              <h3>No Sentences Found</h3>
              <p>No sentences match the current filter selection ({filterMode}).</p>
              <button
                type="button"
                onClick={() => setFilterMode('ALL')}
                className="btn btn-secondary btn-sm"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <div className="sentences-review-list">
              {displayedSentences.map((sentence, index) => (
                <SentenceReviewCard
                  key={sentence.id}
                  sentence={sentence}
                  index={index}
                  total={displayedSentences.length}
                  langCode={activeLangCode}
                  fontFamily={activeLangMeta?.fontFamily}
                  onSave={handleSaveSentence}
                  onApprove={handleApproveSentence}
                  onReopen={handleReopenSentence}
                  onUnsavedChange={handleSentenceUnsavedChange}
                  onPrevSentence={(idx) => handleRequestSentenceNav(idx - 1)}
                  onNextSentence={(idx) => handleRequestSentenceNav(idx + 1)}
                  isSaving={savingMap[sentence.id]}
                  isApproving={approvingMap[sentence.id]}
                />
              ))}
            </div>
          )}

          {/* Unsaved Changes Confirmation Modal Dialog */}
          {pendingNavigation && (
            <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="unsaved-modal-title">
              <div className="modal-dialog">
                <div className="modal-header">
                  <div className="modal-icon-warn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                      <line x1="12" y1="9" x2="12" y2="13"></line>
                      <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                  </div>
                  <h3 id="unsaved-modal-title" className="modal-title">Unsaved Changes Warning</h3>
                </div>
                <div className="modal-body">
                  <p>
                    You have modified one or more translation sentences without saving. If you proceed,
                    your unsaved edits will be discarded.
                  </p>
                  <p className="modal-subtext">
                    Would you like to stay and save your changes, or leave and discard them?
                  </p>
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleStayOnPage}
                  >
                    Stay on Page
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={handleConfirmLeave}
                  >
                    Leave & Discard Edits
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </MainLayout>
  );
};

export default TranslationReview;
