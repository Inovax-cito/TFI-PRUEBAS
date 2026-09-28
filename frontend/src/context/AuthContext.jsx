import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../utils/api.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [businessConfig, setBusinessConfig] = useState(() => {
    try {
      const stored = localStorage.getItem('businessConfig');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiRequest('/notifications');
      setUnreadNotifications(res.unreadCount || 0);
    } catch (err) {
      // Silenciar si no está logueado
    }
  }, [token]);

  // Verificar sesión activa
  useEffect(() => {
    const verifyAuth = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await apiRequest('/auth/me');
        setUser(res.user);
        setBusinessConfig(res.businessConfig);
        localStorage.setItem('user', JSON.stringify(res.user));
        if (res.businessConfig) {
          localStorage.setItem('businessConfig', JSON.stringify(res.businessConfig));
        }
        await fetchUnreadCount();
      } catch (err) {
        logout();
      } finally {
        setLoading(false);
      }
    };

    verifyAuth();
  }, [token, fetchUnreadCount]);

  const login = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    if (data.businessConfig) {
      localStorage.setItem('businessConfig', JSON.stringify(data.businessConfig));
    }
    setToken(data.token);
    setUser(data.user);
    setBusinessConfig(data.businessConfig);
    fetchUnreadCount();
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('businessConfig');
    setToken(null);
    setUser(null);
    setBusinessConfig(null);
  };

  const updateCurrentUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const updateBusinessConfig = (config) => {
    setBusinessConfig(config);
    localStorage.setItem('businessConfig', JSON.stringify(config));
  };

  const isAdmin = user?.role === 'ADMINISTRADOR';

  return (
    <AuthContext.Provider
      value={{
        user,
        businessConfig,
        token,
        loading,
        unreadNotifications,
        isAdmin,
        login,
        logout,
        updateCurrentUser,
        updateBusinessConfig,
        fetchUnreadCount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};
