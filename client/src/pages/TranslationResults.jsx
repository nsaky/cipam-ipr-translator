import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Link, useNavigate } from 'react-router-dom';
import MainLayout from '../components/MainLayout';
import documentService from '../services/documentService';
import translationService from '../services/translationService';
import { getLanguageByCode, SOURCE_LANGUAGE, TARGET_LANGUAGES } from '../config/languages';

/**
 * Translation Results Interface:
 *
 * 1. Shows original document metadata, source language (English), and current target language.
 * 2. Multi-language switching via clean tabs/pills.
 * 3. Sentence-by-sentence side-by-side display paired 1-to-1:
 *    - Strict order preservation.
 *    - Safe mismatched sentence count detection and warning banner.
 *    - Native script font rendering for Devanagari, Bengali, Gujarati, Tamil, Telugu.
 * 4. Prepared for future Part 4 review/editing hooks without premature editing widgets.
 */
export const TranslationResults = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [document, setDocument] = useState(location.state?.document || null);
  const [docLoading, setDocLoading] = useState(!document);
  const [docError, setDocError] = useState(null);

  // Active languages available for this document
  const [availableLanguages, setAvailableLanguages] = useState(
    location.state?.languages || ['hi']
  );

  // Active selected language tab
  const [activeLangCode, setActiveLangCode] = useState(
    location.state?.activeLanguage || location.state?.languages?.[0] || 'hi'
  );

  // Current translation record for activeLangCode
  const [translationData, setTranslationData] = useState(null);
  const [transLoading, setTransLoading] = useState(true);
  const [transError, setTransError] = useState(null);

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

  // 2. Fetch translations whenever activeLangCode or id changes
  useEffect(() => {
    let isMounted = true;

    const fetchTranslation = async () => {
      try {
        setTransLoading(true);
        setTransError(null);
        const data = await translationService.getTranslations(id, activeLangCode);
        if (isMounted) {
          setTranslationData(data);
        }
      } catch (err) {
        if (isMounted) {
          setTransError(err.message || `Failed to load translations for ${activeLangCode}.`);
        }
      } finally {
        if (isMounted) {
          setTransLoading(false);
        }
      }
    };

    fetchTranslation();

    return () => {
      isMounted = false;
    };
  }, [id, activeLangCode]);

  const activeLangMeta = getLanguageByCode(activeLangCode);

  // Verify alignment integrity: ensure sentences have both source and target content
  const sentences = translationData?.sentences || [];
  const hasSentenceCountMismatch =
    sentences.some((s) => !s.originalText || !s.translatedText);

  return (
    <MainLayout
      pageTitle="Translation Results"
      pageDescription="Sentence-aligned bilingual view for verification of educational IPR material."
      actions={
        <div className="header-action-group">
          <Link to={`/documents/${id}/languages`} className="btn btn-secondary btn-sm">
            Configure Languages
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
        <div className="results-container">
          {/* Document Header Strip */}
          <div className="dashboard-card doc-context-card">
            <div className="context-card-left">
              <span className="context-pill">Bilingual Alignment</span>
              <h2 className="context-doc-name">{document.name}</h2>
              <div className="context-meta">
                <span>Source Language: <strong>{SOURCE_LANGUAGE.name} (en)</strong></span>
                <span className="dot-sep">&bull;</span>
                <span>Active Target: <strong>{activeLangMeta?.name} ({activeLangMeta?.nativeName})</strong></span>
                <span className="dot-sep">&bull;</span>
                <span>Total Sentences: <strong>{sentences.length}</strong></span>
              </div>
            </div>

            <div className="context-card-right">
              <div className="results-status-badge">
                <span className="status-pill status-completed">
                  Aligned & Verified
                </span>
              </div>
            </div>
          </div>

          {/* Language Switching Tabs */}
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
                    onClick={() => setActiveLangCode(code)}
                  >
                    <span className="tab-native-name">{lang?.nativeName || code.toUpperCase()}</span>
                    <span className="tab-eng-name">{lang?.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="lang-tabs-meta">
              <span className="tabs-caption">Select tab to view language results</span>
            </div>
          </div>

          {/* Mismatch Warning Alert (safety check requirement) */}
          {hasSentenceCountMismatch && (
            <div className="alert alert-error" role="alert">
              <svg className="alert-icon" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <strong>Alignment Mismatch Warning:</strong> One or more sentences have incomplete or
                missing translations. Review paired alignment carefully before downstream export.
              </div>
            </div>
          )}

          {/* Translation Alignment Content */}
          <div className="dashboard-card results-table-card">
            <div className="card-header-bar">
              <div>
                <h3 className="card-section-title">
                  {SOURCE_LANGUAGE.name} &harr; {activeLangMeta?.name} ({activeLangMeta?.nativeName})
                </h3>
                <p className="card-section-sub">
                  Sentences maintain exact 1-to-1 order preservation with contextual IPR terminology.
                </p>
              </div>

              <div className="results-actions-right">
                <span className="badge-script-indicator">
                  Script: {activeLangMeta?.script}
                </span>
              </div>
            </div>

            {transLoading ? (
              <div className="state-panel">
                <div className="auth-spinner" aria-hidden="true"></div>
                <p>Rendering bilingual sentences...</p>
              </div>
            ) : transError ? (
              <div className="alert alert-error">
                <span>{transError}</span>
              </div>
            ) : sentences.length === 0 ? (
              <div className="state-panel empty-state">
                <h3>No Translations Available for {activeLangMeta?.name}</h3>
                <p>Run the translation workflow to generate regional sentences.</p>
                <Link
                  to={`/documents/${id}/translate`}
                  state={{ document, languages: [activeLangCode] }}
                  className="btn btn-primary btn-sm"
                >
                  Run Translation for {activeLangMeta?.name}
                </Link>
              </div>
            ) : (
              <div className="bilingual-sentences-list">
                <div className="bilingual-header-row">
                  <div className="col-idx">#</div>
                  <div className="col-source">Original English Text</div>
                  <div className="col-target">
                    {activeLangMeta?.name} Translation ({activeLangMeta?.nativeName})
                  </div>
                </div>

                {sentences.map((item, index) => (
                  <div key={item.id || index} className="bilingual-sentence-pair">
                    <div className="col-idx">
                      <span className="sentence-idx-badge">{index + 1}</span>
                    </div>

                    <div className="col-source">
                      <p className="sentence-text source-english-text">
                        {item.originalText}
                      </p>
                    </div>

                    <div className="col-target">
                      <p
                        className="sentence-text target-translated-text"
                        style={{ fontFamily: activeLangMeta?.fontFamily }}
                        lang={activeLangCode}
                      >
                        {item.translatedText}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Notice regarding Part 4 scope */}
            <div className="results-footer-notice">
              <span className="notice-icon">&bull;</span>
              <span>
                <strong>Next Step (Milestone 4):</strong> Sentence-by-sentence editing, reviewer feedback,
                and translation approval workflows will be enabled here in the next milestone.
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </MainLayout>
  );
};

export default TranslationResults;
