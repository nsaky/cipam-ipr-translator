import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '../components/MainLayout';
import documentService from '../services/documentService';

export const Documents = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Sorting state
  const [searchQuery, setSearchQuery] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortOrder, setSortOrder] = useState('NEWEST');

  useEffect(() => {
    let isMounted = true;
    const fetchDocuments = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await documentService.getDocuments();
        if (isMounted) {
          setDocuments(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Unable to retrieve repository documents.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchDocuments();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filtered & Sorted documents
  const filteredDocuments = useMemo(() => {
    let result = [...documents];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (doc) =>
          doc.name?.toLowerCase().includes(q) ||
          doc.uploadedBy?.toLowerCase().includes(q)
      );
    }

    // File type filter
    if (fileTypeFilter !== 'ALL') {
      result = result.filter((doc) => {
        const type = doc.fileType?.toLowerCase();
        if (fileTypeFilter === 'IMAGE') {
          return ['png', 'jpg', 'jpeg'].includes(type);
        }
        return type === fileTypeFilter.toLowerCase();
      });
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      result = result.filter((doc) => doc.status === statusFilter);
    }

    // Sort order
    result.sort((a, b) => {
      const dateA = new Date(a.uploadDate).getTime();
      const dateB = new Date(b.uploadDate).getTime();
      if (sortOrder === 'NEWEST') return dateB - dateA;
      if (sortOrder === 'OLDEST') return dateA - dateB;
      if (sortOrder === 'NAME_AZ') return a.name.localeCompare(b.name);
      if (sortOrder === 'NAME_ZA') return b.name.localeCompare(a.name);
      return 0;
    });

    return result;
  }, [documents, searchQuery, fileTypeFilter, statusFilter, sortOrder]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    fileTypeFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    sortOrder !== 'NEWEST';

  const clearFilters = () => {
    setSearchQuery('');
    setFileTypeFilter('ALL');
    setStatusFilter('ALL');
    setSortOrder('NEWEST');
  };

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
    if (t === 'pdf') return <span className="file-badge file-pdf">PDF</span>;
    if (t === 'docx') return <span className="file-badge file-docx">DOCX</span>;
    if (['png', 'jpg', 'jpeg'].includes(t)) {
      return <span className="file-badge file-img">{t.toUpperCase()}</span>;
    }
    return <span className="file-badge file-other">FILE</span>;
  };

  return (
    <MainLayout
      pageTitle="Document Repository"
      pageDescription="Manage, filter and review source materials across all formats for multi-language translation."
      actions={
        <Link to="/upload" className="btn btn-primary btn-sm">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Upload Document
        </Link>
      }
    >
      <div className="dashboard-card">
        {/* Filter Controls Toolbar */}
        <div className="filter-toolbar">
          <div className="search-input-wrapper">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Search by document name or author..."
              className="form-input filter-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
                title="Clear search text"
              >
                &times;
              </button>
            )}
          </div>

          <div className="filter-selectors">
            {/* File Type Filter */}
            <div className="select-wrapper">
              <label htmlFor="filter-filetype" className="sr-only">Filter by File Type</label>
              <select
                id="filter-filetype"
                className="form-select"
                value={fileTypeFilter}
                onChange={(e) => setFileTypeFilter(e.target.value)}
              >
                <option value="ALL">All File Types</option>
                <option value="PDF">PDF Documents (.pdf)</option>
                <option value="DOCX">Word Documents (.docx)</option>
                <option value="IMAGE">Images (.png, .jpg)</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="select-wrapper">
              <label htmlFor="filter-status" className="sr-only">Filter by Status</label>
              <select
                id="filter-status"
                className="form-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="UPLOADED">Awaiting Translation</option>
                <option value="PENDING_REVIEW">Pending Review</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>

            {/* Sort Order */}
            <div className="select-wrapper">
              <label htmlFor="filter-sort" className="sr-only">Sort By</label>
              <select
                id="filter-sort"
                className="form-select"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="NEWEST">Upload Date: Newest First</option>
                <option value="OLDEST">Upload Date: Oldest First</option>
                <option value="NAME_AZ">Name: A to Z</option>
                <option value="NAME_ZA">Name: Z to A</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="btn btn-secondary btn-sm clear-filters-btn"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Results Metadata */}
        <div className="table-meta-bar">
          <span className="results-count">
            Showing <strong>{filteredDocuments.length}</strong> of <strong>{documents.length}</strong> documents
          </span>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="state-panel">
            <div className="auth-spinner" aria-hidden="true"></div>
            <p>Loading document records...</p>
          </div>
        ) : error ? (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="state-panel empty-state">
            <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
            <h3>No Documents Match Your Filters</h3>
            <p>
              {hasActiveFilters
                ? 'Try resetting your search query or selecting a different status/format filter.'
                : 'No documents have been uploaded yet.'}
            </p>
            {hasActiveFilters ? (
              <button type="button" onClick={clearFilters} className="btn btn-secondary btn-sm">
                Clear Filters
              </button>
            ) : (
              <Link to="/upload" className="btn btn-primary btn-sm">
                Upload New Document
              </Link>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Document Name</th>
                  <th>Format</th>
                  <th>File Size</th>
                  <th>Uploaded Date</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id}>
                    <td className="doc-primary-cell">
                      <Link to={`/documents/${doc.id}`} className="doc-title-link" title={doc.name}>
                        {doc.name}
                      </Link>
                      {doc.uploadedBy && (
                        <span className="doc-uploader-sub">By {doc.uploadedBy}</span>
                      )}
                    </td>
                    <td>{getFileBadge(doc.fileType)}</td>
                    <td className="text-secondary">{documentService.formatFileSize(doc.fileSize)}</td>
                    <td className="text-secondary">{documentService.formatDate(doc.uploadDate)}</td>
                    <td>{getStatusBadge(doc.status)}</td>
                    <td className="text-right">
                      <Link
                        to={`/documents/${doc.id}`}
                        className="btn btn-secondary btn-xs"
                        title="View document metadata and configuration"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Documents;

