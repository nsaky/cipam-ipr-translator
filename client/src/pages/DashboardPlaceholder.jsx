import React from 'react';
import { useAuth } from '../context/AuthContext';

export const DashboardPlaceholder = () => {
  const { user, logout, isMockMode } = useAuth();

  return (
    <div className="dashboard-layout">
      {/* Top Navigation */}
      <header className="topbar">
        <div className="topbar-container">
          <div className="topbar-brand">
            <span className="topbar-emblem">CIPAM</span>
            <div>
              <span className="topbar-title">CIPAM IPR Translator</span>
              <span className="topbar-tagline">National IPR Translation System</span>
            </div>
          </div>

          <div className="topbar-user">
            <div className="user-profile">
              <span className="user-name">{user?.name || 'Authorized Member'}</span>
              <span className="user-email">{user?.email || ''}</span>
              {user?.role && <span className="user-role-badge">{user.role}</span>}
            </div>
            <button
              onClick={logout}
              className="btn btn-secondary btn-sm"
              type="button"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="dashboard-content">
        <div className="placeholder-card">
          <div className="placeholder-badge">Part 1 Complete</div>
          <h2 className="placeholder-heading">Frontend Foundation & Authentication UI</h2>
          <p className="placeholder-description">
            Authentication and routing architecture have been successfully established.
            The complete dashboard, document upload, translation workbench, and review
            modules will be developed in Part 2.
          </p>

          <div className="status-grid">
            <div className="status-item">
              <span className="status-label">Active Session:</span>
              <span className="status-value">{user?.email}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Auth Driver:</span>
              <span className="status-value">
                {isMockMode ? 'Development Mock Service' : 'Backend JWT (/auth/me)'}
              </span>
            </div>
            <div className="status-item">
              <span className="status-label">Assigned Role:</span>
              <span className="status-value">{user?.role || 'Contributor'}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Next Milestone:</span>
              <span className="status-value">Part 2 — Dashboard & Document Upload</span>
            </div>
          </div>

          <div className="placeholder-notice">
            <strong>Architecture Notice:</strong> The authentication layer is decoupled in{' '}
            <code>src/services/authService.js</code>. When Person A completes the Express/PostgreSQL
            backend, toggling <code>VITE_USE_MOCK_AUTH=false</code> in <code>.env</code> will seamlessly
            connect to the live API endpoints without UI modifications.
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPlaceholder;
