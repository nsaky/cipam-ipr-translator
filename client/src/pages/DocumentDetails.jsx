import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import MainLayout from '../components/MainLayout';
import documentService from '../services/documentService';

export const DocumentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchDoc = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await documentService.getDocumentById(id);
        if (isMounted) {
          setDocument(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || `Unable to load document with identifier ${id}.`);
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

  const getFileBadge = (type) => {
    const t = type?.toLowerCase();
    if (t === 'pdf') return <span className="file-badge file-pdf">PDF Document</span>;
    if (t === 'docx') return <span className="file-badge file-docx">Word Document (.docx)</span>;
    if (['png', 'jpg', 'jpeg'].includes(t)) {
      return <span className="file-badge file-img">Image File (.{t})</span>;
    }
    return <span className="file-badge file-other">File</span>;
  };

  return (
    <MainLayout
      pageTitle={document ? document.name : 'Document Details'}
      pageDescription="Inspect metadata, file specifications, and translation processing stage."
      actions={
        <div className="header-action-group">
          <Link to="/documents" className="btn btn-secondary btn-sm">
            &larr; Return to Documents
          </Link>
          <Link to="/upload" className="btn btn-primary btn-sm">
            Upload Another
          </Link>
        </div>
      }
    >
      {loading ? (
        <div className="dashboard-card state-panel">
          <div className="auth-spinner" aria-hidden="true"></div>
          <p>Retrieving document specifications...</p>
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
        <div className="details-grid">
          {/* Main Info Card */}
          <div className="dashboard-card details-main-card">
            <div className="details-header-strip">
              <div>
                <span className="details-identifier">ID: {document.id}</span>
                <h2 className="details-heading">{document.name}</h2>
              </div>
              <div>{getStatusBadge(document.status)}</div>
            </div>

            <div className="details-meta-table">
              <div className="meta-row">
                <span className="meta-label">File Type / Format</span>
                <span className="meta-val">{getFileBadge(document.fileType)}</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">File Size</span>
                <span className="meta-val">{documentService.formatFileSize(document.fileSize)}</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Uploaded On</span>
                <span className="meta-val">{documentService.formatDate(document.uploadDate)}</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Uploaded By</span>
                <span className="meta-val">{document.uploadedBy || 'Contributor'}</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">MIME Type</span>
                <span className="meta-val"><code>{document.mimeType || 'application/octet-stream'}</code></span>
              </div>
            </div>

            {document.description && (
              <div className="details-desc-box">
                <h4 className="desc-title">Description & Context</h4>
                <p className="desc-text">{document.description}</p>
              </div>
            )}
          </div>

          {/* Workflow Stage Next Step Card */}
          <div className="dashboard-card details-workflow-card">
            <h3 className="card-section-title">Translation Workflow Stage</h3>
            <p className="card-section-sub">
              Document registered and queued for regional Indian language translation pipeline.
            </p>

            <div className="workflow-status-callout">
              <span className="workflow-step-num">Step 2 of 4</span>
              <h4 className="workflow-step-title">Language Selection & Translation</h4>
              <p className="workflow-step-desc">
                Select from the 6 agreed regional Indian languages (Hindi, Marathi, Bengali, Gujarati, Tamil, Telugu)
                to begin sentence extraction and automated contextual translation.
              </p>
            </div>

            <div className="workflow-actions-wrap">
              <Link
                to={`/documents/${document.id}/languages`}
                className="btn btn-primary btn-block"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                Translate Document
              </Link>
              <Link to="/documents" className="btn btn-secondary btn-block">
                View All Documents
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </MainLayout>
  );
};

export default DocumentDetails;

