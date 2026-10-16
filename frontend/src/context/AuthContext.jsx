import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../utils/api.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [businessConfig, setBusinessConfig] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('token')));
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const clearSession = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('businessConfig');
    setToken(null);
    setUser(null);
    setBusinessConfig(null);
    setUnreadNotifications(0);
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiRequest('/notifications');
      setUnreadNotifications(res.unreadCount || 0);
    } catch {
      setUnreadNotifications(0);
    }
  }, [token]);

  useEffect(() => {
    let active = true;
    const verifyAuth = async () => {
      if (!token) { setLoading(false); return; }
      try {
        const res = await apiRequest('/auth/me');
        if (!active) return;
        setUser(res.user || null);
        setBusinessConfig(res.businessConfig || null);
      } catch {
        if (active) clearSession();
      } finally {
        if (active) setLoading(false);
      }
    };
    verifyAuth();
    return () => { active = false; };
  }, [token, clearSession]);

  useEffect(() => {
    const handleExpired = () => clearSession();
    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, [clearSession]);

  useEffect(() => { if (token && user) fetchUnreadCount(); }, [token, user, fetchUnreadCount]);

  const login = (data) => {
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    setBusinessConfig(data.businessConfig || null);
    setLoading(false);
  };

  const logout = clearSession;
  const updateCurrentUser = (updatedUser) => setUser(updatedUser);
  const updateBusinessConfig = (config) => setBusinessConfig(config);

  return (
    <AuthContext.Provider value={{
      user, businessConfig, token, loading, unreadNotifications,
      isAdmin: user?.role === 'ADMINISTRADOR', login, logout,
      updateCurrentUser, updateBusinessConfig, fetchUnreadCount,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  return context;
};
