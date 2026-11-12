import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Initialize session on mount
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        setLoading(true);
        const { user: currentUser } = await authService.getCurrentUser();
        if (isMounted) {
          setUser(currentUser || null);
        }
      } catch (err) {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    setAuthError(null);
    try {
      const result = await authService.login(credentials);
      setUser(result.user);
      return result;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }, []);

  const register = useCallback(async (userData) => {
    setAuthError(null);
    try {
      const result = await authService.register(userData);
      setUser(result.user);
      return result;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    setAuthError(null);
    try {
      await authService.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const clearError = useCallback(() => {
    setAuthError(null);
  }, []);

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    authError,
    clearError,
    login,
    register,
    logout,
    isMockMode: authService.isMockMode(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
