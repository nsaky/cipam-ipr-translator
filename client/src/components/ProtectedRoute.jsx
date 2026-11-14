import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute:
 * - Checks if authentication state is still loading (renders clean accessible loader)
 * - If user is unauthenticated, redirects to /login preserving the intended target path
 * - If user is authenticated, renders the protected child component
 */
export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-loading-screen" role="status" aria-live="polite">
        <div className="auth-spinner" aria-hidden="true"></div>
        <p>Verifying secure session...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

/**
 * PublicOnlyRoute:
 * - Redirects already authenticated users away from Login and Register to /dashboard
 */
export const PublicOnlyRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-loading-screen" role="status" aria-live="polite">
        <div className="auth-spinner" aria-hidden="true"></div>
        <p>Loading application...</p>
      </div>
    );
  }

  if (user) {
    // If they were trying to access a specific protected page earlier, take them there
    const destination = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={destination} replace />;
  }

  return children;
};

export default ProtectedRoute;
