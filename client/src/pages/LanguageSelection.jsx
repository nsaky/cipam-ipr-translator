import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import MainLayout from '../components/MainLayout';
import documentService from '../services/documentService';
import { TARGET_LANGUAGES, SOURCE_LANGUAGE } from '../config/languages';

export const LanguageSelection = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLangs, setSelectedLangs] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const fetchDoc = async () => {
      try {
        setLoading(true);
        setError(null);
        const doc = await documentService.getDocumentById(id);
        if (isMounted) {
          setDocument(doc);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || `Unable to locate document ID "${id}".`);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchDoc();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const toggleLanguage = (code) => {
    setSelectedLangs((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSelectAll = () => {
    setSelectedLangs(TARGET_LANGUAGES.map((l) => l.code));
  };

  const handleClearSelection = () => {
    setSelectedLangs([]);
  };

  const handleProceedToTranslation = () => {
    if (selectedLangs.length === 0 || !document) return;
    // Navigate to translation progress/results workflow carrying selected languages
    navigate(`/documents/${document.id}/translate`, {
      state: {
        document,
        languages: selectedLangs,
      },
    });
  };

  return (
    <MainLayout
      pageTitle="Target Language Selection"
      pageDescription="Choose one or multiple regional Indian languages to translate your source IPR material."
      actions={
        <Link to={`/documents/${id}`} className="btn btn-secondary btn-sm">
          &larr; Return to Details
        </Link>
      }
    >
      {loading ? (
        <div className="dashboard-card state-panel">
          <div className="auth-spinner" aria-hidden="true"></div>
          <p>Loading document context...</p>
        </div>
      ) : error ? (
        <div className="dashboard-card">
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <Link to="/documents" className="btn btn-secondary btn-sm">
              &larr; Back to Repository
            </Link>
          </div>
        </div>
      ) : document ? (
        <div className="lang-select-container">
          {/* Source Document Context Bar */}
          <div className="dashboard-card doc-context-card">
            <div className="context-card-left">
              <span className="context-pill">Source Document</span>
              <h2 className="context-doc-name">{document.name}</h2>
              <div className="context-meta">
                <span>Format: <strong>{document.fileType?.toUpperCase()}</strong></span>
                <span className="dot-sep">&bull;</span>
                <span>Size: <strong>{documentService.formatFileSize(document.fileSize)}</strong></span>
                <span className="dot-sep">&bull;</span>
                <span>Source Language: <strong>{SOURCE_LANGUAGE.name} (Fixed)</strong></span>
              </div>
            </div>
            <div className="context-card-right">
              <div className="lang-count-badge">
                <span className="lang-count-num">{selectedLangs.length}</span>
                <span className="lang-count-text">of {TARGET_LANGUAGES.length} selected</span>
              </div>
            </div>
          </div>

          {/* Language Selection Grid */}
          <div className="dashboard-card lang-grid-card">
            <div className="card-header-bar">
              <div>
                <h3 className="card-section-title">Select Target Languages</h3>
                <p className="card-section-sub">
                  Each selected language will be translated while maintaining sentence-level alignment.
                </p>
              </div>
              <div className="bulk-selection-actions">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="btn btn-secondary btn-xs"
                >
                  Select All (6)
                </button>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="btn btn-secondary btn-xs"
                  disabled={selectedLangs.length === 0}
                >
                  Clear Selection
                </button>
              </div>
            </div>

            <div className="languages-grid">
              {TARGET_LANGUAGES.map((lang) => {
                const isSelected = selectedLangs.includes(lang.code);
                return (
                  <div
                    key={lang.code}
                    className={`lang-card ${isSelected ? 'lang-card-selected' : ''}`}
                    onClick={() => toggleLanguage(lang.code)}
                    role="checkbox"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        toggleLanguage(lang.code);
                      }
                    }}
                  >
                    <div className="lang-card-header">
                      <div className="lang-names">
                        <span className="lang-native-name">{lang.nativeName}</span>
                        <span className="lang-english-name">{lang.name}</span>
                      </div>
                      <div className={`lang-checkbox-circle ${isSelected ? 'checked' : ''}`}>
                        {isSelected && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <p className="lang-card-desc">{lang.description}</p>
                    <div className="lang-card-footer">
                      <span className="lang-code-tag">ISO: {lang.code}</span>
                      <span className="lang-script-tag">{lang.script} Script</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions Bar */}
            <div className="lang-actions-bottom">
              <Link to={`/documents/${document.id}`} className="btn btn-secondary">
                Cancel
              </Link>
              <button
                type="button"
                className="btn btn-primary"
                disabled={selectedLangs.length === 0}
                onClick={handleProceedToTranslation}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14"></path>
                  <path d="M12 5l7 7-7 7"></path>
                </svg>
                Proceed with {selectedLangs.length} {selectedLangs.length === 1 ? 'Language' : 'Languages'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </MainLayout>
  );
};

export default LanguageSelection;
