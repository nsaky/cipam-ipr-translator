import axios from 'axios';

/**
 * Central Axios Instance
 *
 * Configured with:
 * - Base URL from environment variable VITE_API_URL (defaults to localhost:5000)
 * - withCredentials: true so that HTTP-only JWT cookies set by Person A's backend
 *   are automatically sent and accepted on cross-origin / same-origin requests.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for centralized error response handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Standardize error message extraction
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'An unexpected network error occurred';
    return Promise.reject(new Error(message));
  }
);

export default api;
