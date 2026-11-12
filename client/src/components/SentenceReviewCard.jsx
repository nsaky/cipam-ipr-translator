import React, { useState, useEffect } from 'react';
import { getLanguageByCode } from '../config/languages';

/**
 * SentenceReviewCard
 *
 * Implements critical Part 4 data distinction:
 * - original_text: Original English sentence (read-only)
 * - machine_text: Original machine translation baseline (read-only)
 * - final_text: Human-editable final version
 * - approved: Approval status
 *
 * Enforces business rules:
 * 1. Modifying text marks unsaved changes.
 * 2. Unsaved changes block approval until saved.
 * 3. Editing an approved sentence clears approval and requires re-review.
 * 4. Empty final text cannot be saved.
 */
export const SentenceReviewCard = ({
  sentence,
  index,
  total,
  langCode,
  fontFamily,
  onSave,
  onApprove,
  onReopen,
  isSaving,
  isApproving,
}) => {
  const [currentText, setCurrentText] = useState(sentence.final_text || sentence.machine_text || '');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [localError, setLocalError] = useState(null);

  // Sync state when parent sentence record changes (e.g. after save)
  useEffect(() => {
    setCurrentText(sentence.final_text || sentence.machine_text || '');
    setHasUnsavedChanges(false);
    setLocalError(null);
  }, [sentence.final_text, sentence.machine_text, sentence.id]);

  const handleTextChange = (e) => {
    const newVal = e.target.value;
    setCurrentText(newVal);
    setHasUnsavedChanges(newVal !== sentence.final_text);
    if (localError) setLocalError(null);
  };

  const handleSaveClick = async () => {
    const trimmed = currentText.trim();
    if (!trimmed) {
      setLocalError('Translation text cannot be empty.');
      return;
    }

    try {
      setLocalError(null);
      await onSave(sentence.id, trimmed);
      setHasUnsavedChanges(false);
    } catch (err) {
      setLocalError(err.message || 'Failed to save changes.');
    }
  };

  const handleResetToMachine = () => {
    setCurrentText(sentence.machine_text);
    setHasUnsavedChanges(sentence.machine_text !== sentence.final_text);
    setLocalError(null);
  };

  const handleApproveClick = async () => {
    if (hasUnsavedChanges) {
      setLocalError('Please save your edits before approving this sentence.');
      return;
    }
    try {
      setLocalError(null);
      await onApprove(sentence.id);
    } catch (err) {
      setLocalError(err.message || 'Failed to update approval status.');
    }
  };

  const handleReopenClick = async () => {
    try {
      setLocalError(null);
      await onReopen(sentence.id);
    } catch (err) {
      setLocalError(err.message || 'Failed to reopen sentence.');
    }
  };

  const isApproved = sentence.approved === true;

  return (
    <div
      id={`sentence-${index + 1}`}
      className={`sentence-card ${isApproved ? 'sentence-approved' : 'sentence-pending'} ${
        hasUnsavedChanges ? 'sentence-unsaved' : ''
      }`}
    >
      {/* Card Header Strip */}
      <div className="sentence-card-header">
        <div className="sentence-num-box">
          <span className="sentence-badge-num">Sentence {index + 1} of {total}</span>
          {hasUnsavedChanges && (
            <span className="unsaved-indicator-pill">Unsaved Changes</span>
          )}
        </div>

        <div className="sentence-status-box">
          {isApproved ? (
            <span className="approval-pill approved-pill">
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Approved
            </span>
          ) : (
            <span className="approval-pill pending-pill">
              Awaiting Review
            </span>
          )}
        </div>
      </div>

      {/* Error alert inside card if any */}
      {localError && (
        <div className="alert alert-error" style={{ margin: '0.75rem 1.25rem 0 1.25rem' }}>
          <span>{localError}</span>
        </div>
      )}

      {/* Tri-Pane Sentence Layout */}
      <div className="sentence-body-grid">
        {/* Pane 1: Original English Text (Read-Only) */}
        <div className="review-pane source-pane">
          <div className="pane-header">
            <span className="pane-label">Original English Text</span>
            <span className="pane-tag">Read-Only</span>
          </div>
          <p className="pane-text-content original-english-content">
            {sentence.original_text}
          </p>
        </div>

        {/* Pane 2: Baseline Machine Translation (Preserved Baseline) */}
        <div className="review-pane machine-pane">
          <div className="pane-header">
            <span className="pane-label">Machine Translation Baseline</span>
            <span className="pane-tag">Original AI</span>
          </div>
          <p
            className="pane-text-content machine-trans-content"
            style={{ fontFamily }}
            lang={langCode}
          >
            {sentence.machine_text}
          </p>
          {sentence.final_text !== sentence.machine_text && (
            <button
              type="button"
              onClick={handleResetToMachine}
              className="btn-link-subtle"
              title="Reset final text to original machine translation"
            >
              Reset to machine baseline
            </button>
          )}
        </div>

        {/* Pane 3: Final Translation (Human Editable) */}
        <div className="review-pane editable-pane">
          <div className="pane-header">
            <span className="pane-label">Final Translation for Export</span>
            <span className="pane-tag-editable">Human Editable</span>
          </div>

          <div className="textarea-wrapper">
            <textarea
              className={`form-input review-textarea ${hasUnsavedChanges ? 'textarea-dirty' : ''}`}
              rows={4}
              value={currentText}
              onChange={handleTextChange}
              placeholder="Enter refined contextual IPR translation..."
              style={{ fontFamily }}
              lang={langCode}
              disabled={isSaving || isApproving}
            />
          </div>

          {/* Action Row for Sentence */}
          <div className="pane-actions-footer">
            <div className="actions-left">
              {hasUnsavedChanges && (
                <span className="unsaved-note">Press "Save Edits" to persist changes</span>
              )}
            </div>

            <div className="actions-right">
              {/* Save Button */}
              <button
                type="button"
                onClick={handleSaveClick}
                className="btn btn-secondary btn-sm"
                disabled={!hasUnsavedChanges || isSaving}
              >
                {isSaving ? (
                  <>
                    <span className="btn-spinner" aria-hidden="true"></span>
                    Saving...
                  </>
                ) : (
                  'Save Edits'
                )}
              </button>

              {/* Approval Button */}
              {isApproved ? (
                <button
                  type="button"
                  onClick={handleReopenClick}
                  className="btn btn-secondary btn-sm reopen-btn"
                  disabled={isApproving || hasUnsavedChanges}
                  title="Reopen sentence for further revisions"
                >
                  {isApproving ? 'Updating...' : 'Reopen Review'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleApproveClick}
                  className="btn btn-primary btn-sm"
                  disabled={isApproving || hasUnsavedChanges}
                  title={hasUnsavedChanges ? 'Save edits first before approving' : 'Mark sentence as approved'}
                >
                  {isApproving ? (
                    <>
                      <span className="btn-spinner" aria-hidden="true"></span>
                      Approving...
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Approve Translation
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SentenceReviewCard;
