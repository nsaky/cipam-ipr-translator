import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '../components/MainLayout';
import documentService from '../services/documentService';

export const Dashboard = () => {
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    recentUploads: 0,
    awaitingTranslation: 0,
    completed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        const docs = await documentService.getDocuments();
        if (isMounted) {
          setDocuments(docs);
          setStats(documentService.calculateStats(docs));
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load document records.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchDashboardData();
    return () => {
      isMounted = false;
    };
  }, []);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="status-pill status-completed">Completed</span>;
      case 'PENDING_REVIEW':
        return <span className="status-pill status-review">Pending Review</span>;
      case 'PROCESSING':
        return <span className="status-pill status-processing">Processing</span>;
      case 'UPLOADED':
      default:
        return <span className="status-pill status-uploaded">Awaiting Translation</span>;
    }
  };

  const getFileIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'pdf':
        return <span className="file-badge file-pdf">PDF</span>;
      case 'docx':
        return <span className="file-badge file-docx">DOCX</span>;
      case 'png':
      case 'jpg':
      case 'jpeg':
        return <span className="file-badge file-img">{type.toUpperCase()}</span>;
      default:
        return <span className="file-badge file-other">FILE</span>;
    }
  };

  const recentDocs = documents.slice(0, 5);

  return (
    <MainLayout
      pageTitle="Translation Workspace Overview"
      pageDescription="Monitor document uploads, translation stages, and regional language review pipelines."
      actions={
        <Link to="/upload" className="btn btn-primary btn-sm">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Upload New Document
        </Link>
      }
    >
      {/* Metric Summary Cards */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon-wrapper stat-icon-neutral">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <div className="stat-body">
            <span className="stat-label">Total Documents</span>
            <span className="stat-number">{loading ? '—' : stats.total}</span>
            <span className="stat-caption">Registered in repository</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper stat-icon-blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className="stat-body">
            <span className="stat-label">Recently Uploaded</span>
            <span className="stat-number">{loading ? '—' : stats.recentUploads}</span>
            <span className="stat-caption">Within the past 7 days</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper stat-icon-amber">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
            </svg>
          </div>
          <div className="stat-body">
            <span className="stat-label">Awaiting Translation</span>
            <span className="stat-number">{loading ? '—' : stats.awaitingTranslation}</span>
            <span className="stat-caption">Ready for extraction / review</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper stat-icon-teal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div className="stat-body">
            <span className="stat-label">Completed Translations</span>
            <span className="stat-number">{loading ? '—' : stats.completed}</span>
            <span className="stat-caption">Export & dissemination ready</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Documents & Quick Action Panels */}
      <div className="dashboard-grid">
        {/* Recent Documents Table */}
        <section className="dashboard-card card-primary">
          <div className="card-header-bar">
            <div>
              <h2 className="card-section-title">Recent Documents</h2>
              <p className="card-section-sub">Latest IPR educational materials uploaded to the repository</p>
            </div>
            <Link to="/documents" className="btn btn-secondary btn-sm">
              View All Documents &rarr;
            </Link>
          </div>

          {loading ? (
            <div className="state-panel">
              <div className="auth-spinner" aria-hidden="true"></div>
              <p>Loading document records...</p>
            </div>
          ) : error ? (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          ) : recentDocs.length === 0 ? (
            <div className="state-panel empty-state">
              <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <line x1="12" y1="11" x2="12" y2="17"></line>
                <line x1="9" y1="14" x2="15" y2="14"></line>
              </svg>
              <h3>No Documents in Repository</h3>
              <p>Upload your first educational Word document, PDF, or image to initiate translation.</p>
              <Link to="/upload" className="btn btn-primary btn-sm">
                Upload Document Now
              </Link>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Type</th>
                    <th>Uploaded</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDocs.map((doc) => (
                    <tr key={doc.id}>
                      <td className="doc-primary-cell">
                        <Link to={`/documents/${doc.id}`} className="doc-title-link" title={doc.name}>
                          {doc.name}
                        </Link>
                        <span className="doc-size-sub">{documentService.formatFileSize(doc.fileSize)}</span>
                      </td>
                      <td>{getFileIcon(doc.fileType)}</td>
                      <td className="text-secondary">{documentService.formatDate(doc.uploadDate)}</td>
                      <td>{getStatusBadge(doc.status)}</td>
                      <td className="text-right">
                        <div className="table-actions-inline">
                          <Link
                            to={`/documents/${doc.id}/languages`}
                            className="btn btn-primary btn-xs"
                            title="Translate document into regional languages"
                          >
                            Translate
                          </Link>
                          <Link to={`/documents/${doc.id}`} className="btn btn-secondary btn-xs">
                            Details
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Side Panel: Quick Actions & Workflow Guide */}
        <section className="dashboard-side-col">
          <div className="dashboard-card quick-actions-card">
            <h3 className="card-section-title">Quick Actions</h3>
            <p className="card-section-sub">Immediate workspace shortcuts</p>
            <div className="quick-actions-list">
              <Link to="/upload" className="action-pill-btn">
                <div className="action-pill-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                </div>
                <div>
                  <span className="action-pill-title">Upload New File</span>
                  <span className="action-pill-desc">Supports DOCX, text PDFs & images up to 10 MB</span>
                </div>
              </Link>

              <Link to="/documents" className="action-pill-btn">
                <div className="action-pill-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="8" y1="6" x2="21" y2="6"></line>
                    <line x1="8" y1="12" x2="21" y2="12"></line>
                    <line x1="8" y1="18" x2="21" y2="18"></line>
                    <line x1="3" y1="6" x2="3.01" y2="6"></line>
                    <line x1="3" y1="12" x2="3.01" y2="12"></line>
                    <line x1="3" y1="18" x2="3.01" y2="18"></line>
                  </svg>
                </div>
                <div>
                  <span className="action-pill-title">Filter Repository</span>
                  <span className="action-pill-desc">Search documents by format, date, or status</span>
                </div>
              </Link>
            </div>
          </div>

          <div className="dashboard-card info-card">
            <h3 className="card-section-title">Supported Target Languages</h3>
            <p className="info-card-text">
              CIPAM IPR Translator converts English materials into 6 authorized Indian languages:
            </p>
            <div className="lang-tag-grid">
              <span className="lang-tag">हिन्दी (Hindi)</span>
              <span className="lang-tag">मराठी (Marathi)</span>
              <span className="lang-tag">বাংলা (Bengali)</span>
              <span className="lang-tag">ગુજરાતી (Gujarati)</span>
              <span className="lang-tag">தமிழ் (Tamil)</span>
              <span className="lang-tag">తెలుగు (Telugu)</span>
            </div>
            <p className="info-footnote">
              *Language selection and sentence extraction pipelines will connect in Milestone 3.
            </p>
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default Dashboard;

