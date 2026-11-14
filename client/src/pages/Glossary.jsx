import React, { useState, useEffect, useMemo } from 'react';
import MainLayout from '../components/MainLayout';
import glossaryService from '../services/glossaryService';
import { useAuth } from '../context/AuthContext';
import { TARGET_LANGUAGES } from '../config/languages';

/**
 * Glossary Management Page
 *
 * Provides:
 * - Search by English source term and across regional language translations.
 * - Filter by target language or category.
 * - Multi-language Indic script rendering.
 * - Admin-only Add Term modal.
 * - Admin-only Delete Term confirmation modal.
 * - Graceful handling of missing regional translations.
 * - Clear distinction of mock vs real API mode.
 */
export const Glossary = () => {
  const { user } = useAuth();

  // Determine admin permissions from user session
  // User role 'Admin' or 'Administrator' or email containing 'admin'
  const isAdmin =
    user?.role?.toLowerCase() === 'admin' ||
    user?.role?.toLowerCase() === 'administrator' ||
    user?.email?.toLowerCase().includes('admin');

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLangFilter, setActiveLangFilter] = useState('ALL'); // 'ALL' or 'hi','mr',...

  // Modals & Action State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState(null); // entry object pending delete confirmation
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null); // { type: 'success'|'error', text: string }

  // New Term Form State
  const [newTermForm, setNewTermForm] = useState({
    term: '',
    category: 'General IPR',
    definition: '',
    translations: {
      hi: '',
      mr: '',
      bn: '',
      gu: '',
      ta: '',
      te: '',
    },
  });
  const [formValidationErrors, setFormValidationErrors] = useState({});

  // 1. Fetch glossary entries
  const fetchGlossary = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await glossaryService.getGlossary();
      setEntries(data);
    } catch (err) {
      setError(err.message || 'Failed to load IPR glossary terminology.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGlossary();
  }, []);

  // 2. Filtered entries
  const filteredEntries = useMemo(() => {
    let result = [...entries];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((entry) => {
        // Match English term or definition
        if (entry.term?.toLowerCase().includes(q)) return true;
        if (entry.definition?.toLowerCase().includes(q)) return true;
        // Match across regional translations
        const transValues = Object.values(entry.translations || {});
        return transValues.some((val) => typeof val === 'string' && val.toLowerCase().includes(q));
      });
    }

    if (activeLangFilter !== 'ALL') {
      result = result.filter((entry) => {
        const trans = entry.translations?.[activeLangFilter];
        return trans && trans.trim() !== '';
      });
    }

    return result;
  }, [entries, searchQuery, activeLangFilter]);

  // 3. Add Term Submit
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormValidationErrors({});
    setActionFeedback(null);

    const termTrimmed = newTermForm.term.trim();
    if (!termTrimmed) {
      setFormValidationErrors({ term: 'English source term is required.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await glossaryService.addEntry(
        {
          term: termTrimmed,
          category: newTermForm.category,
          definition: newTermForm.definition.trim(),
          translations: newTermForm.translations,
        },
        user
      );

      setEntries((prev) => [created, ...prev]);
      setIsAddModalOpen(false);
      setNewTermForm({
        term: '',
        category: 'General IPR',
        definition: '',
        translations: { hi: '', mr: '', bn: '', gu: '', ta: '', te: '' },
      });
      setActionFeedback({
        type: 'success',
        text: `Term "${created.term}" added successfully to IPR glossary.`,
      });
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err) {
      setActionFeedback({
        type: 'error',
        text: err.message || 'Failed to add glossary entry.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Delete Term Confirm
  const handleConfirmDelete = async () => {
    if (!deletingEntry) return;
    setIsSubmitting(true);
    setActionFeedback(null);

    try {
      await glossaryService.deleteEntry(deletingEntry.id, deletingEntry.term);
      setEntries((prev) => prev.filter((e) => e.id !== deletingEntry.id));
      setActionFeedback({
        type: 'success',
        text: `Term "${deletingEntry.term}" removed from IPR glossary.`,
      });
      setDeletingEntry(null);
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err) {
      setActionFeedback({
        type: 'error',
        text: err.message || 'Failed to delete glossary entry.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout
      pageTitle="IPR Terminology Glossary"
      pageDescription="Authoritative reference dictionary for standardizing Intellectual Property Rights concepts across 6 Indian regional languages."
      actions={
        isAdmin ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setIsAddModalOpen(true);
              setActionFeedback(null);
            }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add New Term (Admin)
          </button>
        ) : (
          <span className="user-role-notice-pill">
            Logged in as {user?.role || 'Member'} (Read-Only)
          </span>
        )
      }
    >
      <div className="glossary-page-wrap">
        {/* Feedback Alert */}
        {actionFeedback && (
          <div
            className={`alert ${actionFeedback.type === 'success' ? 'alert-success' : 'alert-error'}`}
            role="alert"
          >
            <span>{actionFeedback.text}</span>
          </div>
        )}

        {/* Toolbar & Search Bar */}
        <div className="dashboard-card glossary-toolbar-card">
          <div className="glossary-search-row">
            <div className="search-input-wrapper">
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                className="form-input filter-search-input"
                placeholder="Search across English terms or regional translations (e.g. Patent, पेटेंट, காப்புரிமை)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  &times;
                </button>
              )}
            </div>

            <div className="glossary-filter-pills">
              <button
                type="button"
                className={`lang-filter-btn ${activeLangFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setActiveLangFilter('ALL')}
              >
                All Languages
              </button>
              {TARGET_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  className={`lang-filter-btn ${activeLangFilter === lang.code ? 'active' : ''}`}
                  onClick={() => setActiveLangFilter(lang.code)}
                >
                  {lang.nativeName} ({lang.name})
                </button>
              ))}
            </div>
          </div>

          <div className="glossary-meta-strip">
            <span className="results-count">
              Showing <strong>{filteredEntries.length}</strong> of <strong>{entries.length}</strong> standardized IPR terms
            </span>
            {glossaryService.isMockMode() && (
              <span className="mock-badge">Mock Development Mode (Local Persisted)</span>
            )}
          </div>
        </div>

        {/* Glossary Table / List Card */}
        <div className="dashboard-card glossary-table-card">
          {loading ? (
            <div className="state-panel">
              <div className="auth-spinner" aria-hidden="true" />
              <p>Loading glossary records...</p>
            </div>
          ) : error ? (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="state-panel empty-state">
              <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
              <h3>No Matching Glossary Terms</h3>
              <p>No IPR terminology entries match your search query or language filter.</p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSearchQuery('');
                  setActiveLangFilter('ALL');
                }}
              >
                Reset Search Filters
              </button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table glossary-data-table">
                <thead>
                  <tr>
                    <th style={{ width: '22%' }}>English Source Term</th>
                    <th style={{ width: '13%' }}>Hindi (हिन्दी)</th>
                    <th style={{ width: '13%' }}>Marathi (मराठी)</th>
                    <th style={{ width: '13%' }}>Bengali (বাংলা)</th>
                    <th style={{ width: '13%' }}>Gujarati (ગુજરાતી)</th>
                    <th style={{ width: '13%' }}>Tamil (தமிழ்)</th>
                    <th style={{ width: '13%' }}>Telugu (తెలుగు)</th>
                    {isAdmin && <th className="text-right" style={{ width: '8%' }}>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((item) => (
                    <tr key={item.id}>
                      <td className="doc-primary-cell">
                        <span className="glossary-term-name">{item.term}</span>
                        {item.definition && (
                          <span className="glossary-definition-sub">{item.definition}</span>
                        )}
                        <span className="glossary-cat-badge">{item.category}</span>
                      </td>

                      {/* 6 Regional Language Columns */}
                      <td className="indic-cell indic-hi">
                        {item.translations?.hi || <span className="missing-trans">—</span>}
                      </td>
                      <td className="indic-cell indic-mr">
                        {item.translations?.mr || <span className="missing-trans">—</span>}
                      </td>
                      <td className="indic-cell indic-bn">
                        {item.translations?.bn || <span className="missing-trans">—</span>}
                      </td>
                      <td className="indic-cell indic-gu">
                        {item.translations?.gu || <span className="missing-trans">—</span>}
                      </td>
                      <td className="indic-cell indic-ta">
                        {item.translations?.ta || <span className="missing-trans">—</span>}
                      </td>
                      <td className="indic-cell indic-te">
                        {item.translations?.te || <span className="missing-trans">—</span>}
                      </td>

                      {/* Admin Delete Action */}
                      {isAdmin && (
                        <td className="text-right">
                          <button
                            type="button"
                            className="btn btn-danger-ghost btn-xs"
                            onClick={() => setDeletingEntry(item)}
                            title="Delete glossary term (Admin)"
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Term Modal (Admin Only) */}
      {isAddModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="add-term-title">
          <div className="modal-dialog modal-dialog-lg">
            <div className="modal-header">
              <div className="modal-icon-brand">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
              </div>
              <div>
                <h3 id="add-term-title" className="modal-title">Add IPR Glossary Entry</h3>
                <p className="modal-subtext">Add an approved English term and regional translations to guide translation consistency.</p>
              </div>
            </div>

            <form onSubmit={handleAddSubmit} className="glossary-modal-form">
              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="new-term" className="form-label">
                    English Source Term <span className="text-danger">*</span>
                  </label>
                  <input
                    id="new-term"
                    type="text"
                    required
                    className={`form-input ${formValidationErrors.term ? 'input-error' : ''}`}
                    placeholder="e.g. Prior Art"
                    value={newTermForm.term}
                    onChange={(e) =>
                      setNewTermForm((prev) => ({ ...prev, term: e.target.value }))
                    }
                  />
                  {formValidationErrors.term && (
                    <span className="form-error-text">{formValidationErrors.term}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="new-cat" className="form-label">
                    Category
                  </label>
                  <select
                    id="new-cat"
                    className="form-select"
                    value={newTermForm.category}
                    onChange={(e) =>
                      setNewTermForm((prev) => ({ ...prev, category: e.target.value }))
                    }
                  >
                    <option value="General IPR">General IPR</option>
                    <option value="Industrial Property">Industrial Property</option>
                    <option value="Commercial Marks">Commercial Marks</option>
                    <option value="Literary & Artistic">Literary & Artistic</option>
                    <option value="Origin & Heritage">Origin & Heritage</option>
                    <option value="Enforcement">Enforcement</option>
                    <option value="Commercialization">Commercialization</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="new-def" className="form-label">
                  Definition / Context
                </label>
                <input
                  id="new-def"
                  type="text"
                  className="form-input"
                  placeholder="Brief legal/educational meaning..."
                  value={newTermForm.definition}
                  onChange={(e) =>
                    setNewTermForm((prev) => ({ ...prev, definition: e.target.value }))
                  }
                />
              </div>

              <h4 className="form-section-heading">Regional Language Translations</h4>
              <div className="form-grid-3">
                {TARGET_LANGUAGES.map((lang) => (
                  <div key={lang.code} className="form-group">
                    <label className="form-label">
                      {lang.name} ({lang.nativeName})
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={`Enter ${lang.name} translation...`}
                      style={{ fontFamily: lang.fontFamily }}
                      value={newTermForm.translations[lang.code] || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewTermForm((prev) => ({
                          ...prev,
                          translations: {
                            ...prev.translations,
                            [lang.code]: val,
                          },
                        }));
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="btn-spinner" aria-hidden="true" />
                      Saving Term...
                    </>
                  ) : (
                    'Add Term to Glossary'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Admin Only) */}
      {deletingEntry && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-term-title">
          <div className="modal-dialog">
            <div className="modal-header">
              <div className="modal-icon-warn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
              <h3 id="delete-term-title" className="modal-title">Confirm Term Deletion</h3>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to permanently delete the term <strong>"{deletingEntry.term}"</strong> from the IPR glossary?
              </p>
              <p className="modal-subtext">
                This will remove standard translations across all regional Indian languages. This action cannot be undone.
              </p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isSubmitting}
                onClick={() => setDeletingEntry(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={isSubmitting}
                onClick={handleConfirmDelete}
              >
                {isSubmitting ? 'Deleting...' : 'Delete Term'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default Glossary;
