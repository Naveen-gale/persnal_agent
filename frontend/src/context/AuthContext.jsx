import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [googleStatus, setGoogleStatus] = useState(null);

  const refreshGoogleStatus = useCallback(async () => {
    try {
      const res = await api.getGoogleStatus();
      const status = res?.integration || res || { connected: false };
      setGoogleStatus(status);
    } catch {
      setGoogleStatus({ connected: false });
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.getMe();
      if (res && res.user) {
        setUser(res.user);
        if (res.user.googleIntegration) {
          setGoogleStatus(res.user.googleIntegration);
        }
        await refreshGoogleStatus();
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [refreshGoogleStatus]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email, password) => {
    const res = await api.login(email, password);
    setUser(res.user);
    await refreshGoogleStatus();
    return res.user;
  };

  const register = async (email, password, name) => {
    const res = await api.register(email, password, name);
    setUser(res.user);
    await refreshGoogleStatus();
    return res.user;
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    setGoogleStatus(null);
  };

  const value = {
    user,
    loading,
    googleStatus,
    refreshUser,
    refreshGoogleStatus,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
