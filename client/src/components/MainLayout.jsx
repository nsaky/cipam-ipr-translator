import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Main Layout with persistent Sidebar, Header, and breadcrumb/title area.
 * Clean, government/educational portal styling.
 */
export const MainLayout = ({ children, pageTitle, pageDescription, actions }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const navItems = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
      ),
      disabled: false,
    },
    {
      to: '/documents',
      label: 'My Documents',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      ),
      disabled: false,
    },
    {
      to: '/upload',
      label: 'Upload Document',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
      ),
      disabled: false,
    },
    {
      to: '#',
      label: 'IPR Glossary',
      badge: 'Coming Soon',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
      ),
      disabled: true,
    },
  ];

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="mobile-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`app-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand-wrapper">
          <div className="sidebar-brand">
            <span className="brand-badge">CIPAM</span>
            {!sidebarCollapsed && (
              <div className="brand-text">
                <span className="brand-title">IPR Translator</span>
                <span className="brand-sub">Translation Portal</span>
              </div>
            )}
          </div>
          <button
            type="button"
            className="sidebar-collapse-toggle desktop-only"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label="Toggle sidebar width"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {sidebarCollapsed ? (
                <polyline points="9 18 15 12 9 6" />
              ) : (
                <polyline points="15 18 9 12 15 6" />
              )}
            </svg>
          </button>
        </div>

        {/* Navigation items */}
        <nav className="sidebar-nav">
          <ul className="nav-list">
            {navItems.map((item, idx) => (
              <li key={idx} className="nav-item">
                {item.disabled ? (
                  <span className="nav-link disabled-nav" title="Coming in future milestone">
                    <span className="nav-icon">{item.icon}</span>
                    {!sidebarCollapsed && (
                      <span className="nav-label-group">
                        <span className="nav-label">{item.label}</span>
                        {item.badge && <span className="nav-badge-pill">{item.badge}</span>}
                      </span>
                    )}
                  </span>
                ) : (
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `nav-link ${isActive ? 'active' : ''}`
                    }
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    {!sidebarCollapsed && (
                      <span className="nav-label">{item.label}</span>
                    )}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Sidebar Footer User Area */}
        <div className="sidebar-footer">
          <div className="sidebar-user-block">
            <div className="user-avatar" title={user?.name || user?.email}>
              {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div className="user-info">
                <span className="user-display-name">{user?.name || 'Authorized Member'}</span>
                <span className="user-display-email" title={user?.email}>{user?.email}</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Application Area */}
      <div className="app-main-wrap">
        {/* Top Header Bar */}
        <header className="app-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-hamburger mobile-only"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <div className="header-meta">
              <span className="header-org-tag">Cell for IPR Promotion and Management (CIPAM)</span>
            </div>
          </div>

          <div className="topbar-actions">
            <NavLink to="/upload" className="btn btn-primary btn-sm">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>Upload Document</span>
            </NavLink>
            <button
              type="button"
              onClick={handleLogout}
              className="btn btn-secondary btn-sm"
              title="Sign out of your session"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Page Context Banner */}
        {(pageTitle || actions) && (
          <section className="page-header-banner">
            <div className="page-header-text">
              {pageTitle && <h1 className="page-title">{pageTitle}</h1>}
              {pageDescription && <p className="page-description">{pageDescription}</p>}
            </div>
            {actions && <div className="page-header-actions">{actions}</div>}
          </section>
        )}

        {/* Page Main Content */}
        <main className="app-content-body">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;

