import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import MainLayout from '../components/MainLayout';
import documentService from '../services/documentService';
import { useAuth } from '../context/AuthContext';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB in bytes
const ALLOWED_EXTENSIONS = ['docx', 'pdf', 'png', 'jpg', 'jpeg'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/jpg',
];

export const UploadDocument = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [description, setDescription] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Validate file against agreed project specifications
  const validateFile = (file) => {
    if (!file) {
      return 'Please choose a file to upload.';
    }

    // Check size limit (10 MB)
    if (file.size > MAX_FILE_SIZE) {
      return `File exceeds the maximum 10 MB limit (${documentService.formatFileSize(file.size)}).`;
    }

    // Check file extension
    const extMatch = file.name.match(/\.([0-9a-z]+)$/i);
    const extension = extMatch ? extMatch[1].toLowerCase() : '';

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return `Unsupported file format ".${extension || 'unknown'}". Allowed formats: .docx, .pdf, .png, .jpg, .jpeg.`;
    }

    return null;
  };

  const handleFileSelection = (file) => {
    setErrorMessage('');
    setSuccessMessage('');

    const validationError = validateFile(file);
    if (validationError) {
      setErrorMessage(validationError);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uploading) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (uploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      handleFileSelection(droppedFile);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setErrorMessage('');
    setSuccessMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!selectedFile) {
      setErrorMessage('Please select a valid document or image first.');
      return;
    }

    const validationError = validateFile(selectedFile);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setUploading(true);

    try {
      const createdDoc = await documentService.uploadDocument(selectedFile, {
        description: description.trim(),
        uploadedBy: user?.name || user?.email || 'Contributor',
      });

      setSuccessMessage(
        `Document "${createdDoc.name}" uploaded successfully! Redirecting to details...`
      );

      // Brief delay to display feedback, then navigate to details view
      setTimeout(() => {
        navigate(`/documents/${createdDoc.id}`);
      }, 1000);
    } catch (err) {
      setErrorMessage(err.message || 'An error occurred during file upload.');
      setUploading(false);
    }
  };

  const getExtensionBadge = (filename) => {
    const ext = filename?.split('.').pop()?.toUpperCase() || 'FILE';
    return <span className="file-badge file-neutral">{ext}</span>;
  };

  return (
    <MainLayout
      pageTitle="Upload Document for Translation"
      pageDescription="Ingest educational and informational IPR materials in DOCX, text PDF, or image formats."
    >
      <div className="upload-container">
        <div className="dashboard-card upload-card">
          {/* Important Project Notice on PDF Limitations */}
          <div className="scope-callout">
            <div className="callout-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <div className="callout-content">
              <strong>Supported Formats & PDF Scope:</strong>
              <p>
                Word documents (<code>.docx</code>), text-based PDFs (<code>.pdf</code>), and standalone image flyers (<code>.png</code>, <code>.jpg</code>, <code>.jpeg</code>) are accepted up to 10 MB.
                <em> Note: Scanned/image-only PDFs are excluded from this processing engine.</em>
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="alert alert-error" role="alert">
              <svg className="alert-icon" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="alert alert-success" role="alert">
              <svg className="alert-icon" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleUploadSubmit} className="upload-form">
            {/* Drag & Drop Zone */}
            <div
              className={`dropzone ${dragActive ? 'dropzone-active' : ''} ${selectedFile ? 'dropzone-has-file' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                id="file-upload-input"
                className="file-hidden-input"
                accept=".docx,.pdf,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"
                disabled={uploading}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelection(e.target.files[0]);
                  }
                }}
              />

              {!selectedFile ? (
                <div className="dropzone-empty-content">
                  <div className="dropzone-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                  </div>
                  <h3 className="dropzone-prompt">Drag & drop your file here</h3>
                  <p className="dropzone-or">or</p>
                  <label htmlFor="file-upload-input" className="btn btn-secondary btn-sm browse-btn">
                    Browse Local Files
                  </label>
                  <div className="dropzone-meta">
                    <span>Accepted: DOCX, PDF, PNG, JPG</span>
                    <span className="dot-sep">&bull;</span>
                    <span>Max Size: 10 MB</span>
                  </div>
                </div>
              ) : (
                <div className="file-preview-card">
                  <div className="file-preview-left">
                    {getExtensionBadge(selectedFile.name)}
                    <div className="file-preview-meta">
                      <span className="file-preview-name">{selectedFile.name}</span>
                      <span className="file-preview-size">
                        {documentService.formatFileSize(selectedFile.size)}
                      </span>
                    </div>
                  </div>
                  <div className="file-preview-actions">
                    <label htmlFor="file-upload-input" className="btn btn-secondary btn-xs" title="Replace file">
                      Replace
                    </label>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="btn btn-danger-ghost btn-xs"
                      title="Remove file"
                      disabled={uploading}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Optional Metadata: Brief Description */}
            <div className="form-group">
              <label htmlFor="upload-description" className="form-label">
                Document Description / Context (Optional)
              </label>
              <textarea
                id="upload-description"
                rows="3"
                className="form-input form-textarea"
                placeholder="Briefly state the intended audience or educational purpose of this IPR material..."
                value={description}
                disabled={uploading}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Form Action Controls */}
            <div className="form-actions-row">
              <Link to="/documents" className="btn btn-secondary">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={!selectedFile || uploading}
                className="btn btn-primary"
              >
                {uploading ? (
                  <>
                    <span className="btn-spinner" aria-hidden="true"></span>
                    Uploading & Registering...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    Confirm & Upload Document
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </MainLayout>
  );
};

export default UploadDocument;

