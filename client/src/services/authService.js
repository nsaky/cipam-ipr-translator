import api from './api';

/**
 * Authentication Service
 *
 * Supports dual-mode operation:
 * 1. Mock Mode (default when VITE_USE_MOCK_AUTH !== 'false'):
 *    Runs client-side simulation using sessionStorage for user state.
 *    Does NOT store real JWT tokens in web storage (strictly adheres to security boundary).
 *
 * 2. Real API Mode (Person A Backend):
 *    Calls /auth/login, /auth/register, /auth/logout, and /auth/me.
 *    Relies on HTTP-only cookies managed by the backend server.
 */

const USE_MOCK = import.meta.env.VITE_USE_MOCK_AUTH !== 'false';
const MOCK_STORAGE_KEY = 'cipam_mock_session';
const MOCK_USERS_DB_KEY = 'cipam_mock_registered_users';

// Seed default mock user if none exists
const getMockUsers = () => {
  try {
    const data = localStorage.getItem(MOCK_USERS_DB_KEY);
    if (data) return JSON.parse(data);
  } catch {
    // Ignore storage parse error
  }
  const defaultUsers = [
    {
      id: 'usr_mock_1',
      name: 'Mohammad Yasir Iqbal',
      email: 'user@cipam.gov.in',
      password: 'Password123!',
      role: 'Reviewer',
    },
  ];
  try {
    localStorage.setItem(MOCK_USERS_DB_KEY, JSON.stringify(defaultUsers));
  } catch {
    // Ignore storage write error
  }
  return defaultUsers;
};

// Simulate server response latency
const simulateNetworkDelay = (ms = 400) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const authService = {
  /**
   * Login user
   * @param {Object} credentials - { email, password, rememberMe }
   * @returns {Promise<{ user: Object, message: string }>}
   */
  async login({ email, password, rememberMe }) {
    if (USE_MOCK) {
      await simulateNetworkDelay(500);
      const cleanEmail = email.trim().toLowerCase();
      const users = getMockUsers();
      const existingUser = users.find(
        (u) => u.email.toLowerCase() === cleanEmail
      );

      if (!existingUser) {
        throw new Error('No account found with this email address.');
      }

      if (existingUser.password !== password) {
        throw new Error('Incorrect password. Please verify and try again.');
      }

      // Safe user session object without password
      const userSession = {
        id: existingUser.id,
        name: existingUser.name,
        email: existingUser.email,
        role: existingUser.role || 'Member',
        authenticatedAt: new Date().toISOString(),
      };

      // Persist session across refresh
      // If rememberMe is checked, save in localStorage, otherwise sessionStorage
      if (rememberMe) {
        localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(userSession));
      } else {
        sessionStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(userSession));
      }

      return { user: userSession, message: 'Logged in successfully.' };
    }

    // Real API Mode with Person A's backend
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  /**
   * Register new user
   * @param {Object} userData - { name, email, password }
   * @returns {Promise<{ user: Object, message: string }>}
   */
  async register({ name, email, password }) {
    if (USE_MOCK) {
      await simulateNetworkDelay(600);
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = name.trim();
      const users = getMockUsers();

      if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
        throw new Error('An account with this email address already exists.');
      }

      const newUser = {
        id: `usr_${Date.now()}`,
        name: cleanName,
        email: cleanEmail,
        password: password,
        role: 'Translator',
      };

      users.push(newUser);
      try {
        localStorage.setItem(MOCK_USERS_DB_KEY, JSON.stringify(users));
      } catch {
        // storage write error
      }

      const userSession = {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        authenticatedAt: new Date().toISOString(),
      };

      // Auto sign-in into mock session upon registration
      sessionStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(userSession));

      return {
        user: userSession,
        message: 'Registration completed successfully.',
      };
    }

    // Real API Mode with Person A's backend
    const response = await api.post('/auth/register', { name, email, password });
    return response.data;
  },

  /**
   * Logout user
   * @returns {Promise<{ success: boolean }>}
   */
  async logout() {
    if (USE_MOCK) {
      await simulateNetworkDelay(200);
      sessionStorage.removeItem(MOCK_STORAGE_KEY);
      localStorage.removeItem(MOCK_STORAGE_KEY);
      return { success: true };
    }

    // Real API Mode: instructs backend to clear the HTTP-only cookie
    const response = await api.post('/auth/logout');
    return response.data;
  },

  /**
   * Get current authenticated user session (/auth/me)
   * @returns {Promise<{ user: Object | null }>}
   */
  async getCurrentUser() {
    if (USE_MOCK) {
      await simulateNetworkDelay(250);
      // Check sessionStorage first, then localStorage (for Remember Me)
      const sessionData =
        sessionStorage.getItem(MOCK_STORAGE_KEY) ||
        localStorage.getItem(MOCK_STORAGE_KEY);

      if (sessionData) {
        try {
          return { user: JSON.parse(sessionData) };
        } catch {
          sessionStorage.removeItem(MOCK_STORAGE_KEY);
          localStorage.removeItem(MOCK_STORAGE_KEY);
        }
      }
      return { user: null };
    }

    // Real API Mode with Person A's backend
    try {
      const response = await api.get('/auth/me');
      return response.data;
    } catch {
      return { user: null };
    }
  },

  /**
   * Check if current environment is running mock mode
   */
  isMockMode() {
    return USE_MOCK;
  },
};

export default authService;
