import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Login = () => {
  const { login, isMockMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  const validateForm = () => {
    const errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!emailRegex.test(formData.email.trim())) {
      errors.email = 'Please provide a valid email format (e.g. user@domain.com).';
    }

    if (!formData.password) {
      errors.password = 'Password is required.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    // Clear field-specific validation error on change
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
      await login(formData);
      const destination = location.state?.from?.pathname || '/dashboard';
      navigate(destination, { replace: true });
    } catch (err) {
      setErrorMessage(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUseMockCredentials = () => {
    setFormData({
      email: 'user@cipam.gov.in',
      password: 'Password123!',
      rememberMe: true,
    });
    setValidationErrors({});
    setErrorMessage('');
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
          <h2 className="auth-heading">Sign in to your account</h2>
          <p className="auth-description">
            Access documents, translation workflows, and regional review workspaces.
          </p>

          {isMockMode && (
            <div className="mock-banner" role="note">
              <div className="mock-banner-header">
                <span className="mock-badge">Development Mock Mode</span>
                <button
                  type="button"
                  onClick={handleUseMockCredentials}
                  className="mock-fill-btn"
                >
                  Fill Sample Credentials
                </button>
              </div>
              <p className="mock-hint">
                Default: <code>user@cipam.gov.in</code> / <code>Password123!</code>
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
              <label htmlFor="login-email" className="form-label">
                Email Address
              </label>
              <input
                id="login-email"
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
              <div className="form-label-row">
                <label htmlFor="login-password" className="form-label">
                  Password
                </label>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() =>
                    alert(
                      'Password recovery will be supported through CIPAM administrator directory in production.'
                    )
                  }
                >
                  Forgot password?
                </button>
              </div>

              <div className="password-input-wrapper">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  disabled={submitting}
                  className={`form-input ${validationErrors.password ? 'input-error' : ''}`}
                  placeholder="Enter your password"
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

            <div className="form-checkbox-row">
              <label className="checkbox-label" htmlFor="rememberMe">
                <input
                  id="rememberMe"
                  name="rememberMe"
                  type="checkbox"
                  disabled={submitting}
                  checked={formData.rememberMe}
                  onChange={handleChange}
                />
                <span>Remember me on this device</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary btn-block"
            >
              {submitting ? (
                <>
                  <span className="btn-spinner" aria-hidden="true"></span>
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <footer className="auth-footer">
            <p>
              Don't have an authorized account?{' '}
              <Link to="/register" className="auth-link">
                Register here
              </Link>
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Login;
