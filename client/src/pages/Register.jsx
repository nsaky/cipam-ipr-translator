import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Register = () => {
  const { register, isMockMode } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  const validateForm = () => {
    const errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Name validation
    if (!formData.name.trim()) {
      errors.name = 'Full name is required.';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters.';
    }

    // Email validation
    if (!formData.email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!emailRegex.test(formData.email.trim())) {
      errors.email = 'Please provide a valid email format (e.g. user@domain.com).';
    }

    // Password validation (min 8 chars, 1 number or special symbol)
    if (!formData.password) {
      errors.password = 'Password is required.';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    } else if (!/(?=.*[0-9])|(?=.*[!@#$%^&*])/.test(formData.password)) {
      errors.password = 'Password must include at least one number or special character.';
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Confirmation password is required.';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (validationErrors[name]) {
      setValidationErrors((prev) => ({ ...prev, [name]: null }));
    }
    if (errorMessage) {
      setErrorMessage('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!validateForm()) return;

    setSubmitting(true);
    try {
      await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });
      // Redirect to dashboard on successful registration
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setErrorMessage(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-card">
        {/* Header / Branding */}
        <header className="auth-header">
          <div className="auth-emblem">
            <span className="auth-emblem-tag">CIPAM</span>
          </div>
          <h1 className="auth-title">CIPAM IPR Translator</h1>
          <p className="auth-subtitle">
            Cell for IPR Promotion and Management &bull; Translation Portal
          </p>
        </header>

        <div className="auth-content">
          <h2 className="auth-heading">Create your account</h2>
          <p className="auth-description">
            Register to contribute to regional language IPR educational materials.
          </p>

          {isMockMode && (
            <div className="mock-banner" role="note">
              <span className="mock-badge">Development Mock Mode</span>
              <p className="mock-hint">
                New accounts created here will be preserved in your browser session.
              </p>
            </div>
          )}

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

          <form onSubmit={handleSubmit} noValidate className="auth-form">
            <div className="form-group">
              <label htmlFor="register-name" className="form-label">
                Full Name
              </label>
              <input
                id="register-name"
                name="name"
                type="text"
                autoComplete="name"
                required
                disabled={submitting}
                className={`form-input ${validationErrors.name ? 'input-error' : ''}`}
                placeholder="e.g. Dr. Rajesh Kumar"
                value={formData.name}
                onChange={handleChange}
              />
              {validationErrors.name && (
                <span className="form-error-text" role="alert">
                  {validationErrors.name}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="register-email" className="form-label">
                Official Email Address
              </label>
              <input
                id="register-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={submitting}
                className={`form-input ${validationErrors.email ? 'input-error' : ''}`}
                placeholder="name@organization.gov.in"
                value={formData.email}
                onChange={handleChange}
              />
              {validationErrors.email && (
                <span className="form-error-text" role="alert">
                  {validationErrors.email}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="register-password" className="form-label">
                Password
              </label>
              <div className="password-input-wrapper">
                <input
                  id="register-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  disabled={submitting}
                  className={`form-input ${validationErrors.password ? 'input-error' : ''}`}
                  placeholder="Min 8 characters with number/symbol"
                  value={formData.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={0}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {validationErrors.password && (
                <span className="form-error-text" role="alert">
                  {validationErrors.password}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="register-confirm-password" className="form-label">
                Confirm Password
              </label>
              <div className="password-input-wrapper">
                <input
                  id="register-confirm-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  disabled={submitting}
                  className={`form-input ${validationErrors.confirmPassword ? 'input-error' : ''}`}
                  placeholder="Re-enter your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  tabIndex={0}
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {validationErrors.confirmPassword && (
                <span className="form-error-text" role="alert">
                  {validationErrors.confirmPassword}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary btn-block"
            >
              {submitting ? (
                <>
                  <span className="btn-spinner" aria-hidden="true"></span>
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <footer className="auth-footer">
            <p>
              Already have an account?{' '}
              <Link to="/login" className="auth-link">
                Sign in
              </Link>
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Register;
