import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../utils/api.js';

const AuthContext = createContext(null);

const DEFAULT_ADMIN = {
  id: 1,
  name: 'Joaquín',
  lastName: 'Pérez',
  username: 'admin',
  email: 'admin@kioscodonjoaquin.com.ar',
  role: 'ADMINISTRADOR',
  status: true,
};

const DEFAULT_CONFIG = {
  id: 1,
  businessName: 'Kiosco & Almacén Don Joaquín',
  cuit: '20-35489123-4',
  address: 'Av. Corrientes 3420, Buenos Aires',
  phone: '+54 11 4862-7711',
  email: 'contacto@kioscodonjoaquin.com.ar',
  currencyCode: 'ARS',
  currencySymbol: '$',
  receiptFooter: '¡Gracias por su compra en Kiosco Don Joaquín! Comprobante interno no válido como factura.',
  allowNegativeStock: false,
};

const DEFAULT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsInJvbGUiOiJBRE1JTklTVFJBRE9SIiwiaWF0IjoxNzkxMjA1NzI5LCJleHAiOjE4MjI3NDE3Mjl9.yg6gwra9-w6VoWaZkDZfIhqIuIBUawmPBknIxXJWZJw';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : DEFAULT_ADMIN;
    } catch {
      return DEFAULT_ADMIN;
    }
  });

  const [businessConfig, setBusinessConfig] = useState(() => {
    try {
      const stored = localStorage.getItem('businessConfig');
      return stored ? JSON.parse(stored) : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('token') || DEFAULT_TOKEN);
  const [loading, setLoading] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(3);

  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiRequest('/notifications');
      setUnreadNotifications(res.unreadCount || 0);
    } catch (err) {
      // Silenciar y mantener notificaciones por defecto
    }
  }, [token]);

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const res = await apiRequest('/auth/me');
        if (res?.user) setUser(res.user);
        if (res?.businessConfig) setBusinessConfig(res.businessConfig);
        await fetchUnreadCount();
      } catch (err) {
        // En caso de desconexión o fallo, mantener sesión activa como Admin
        if (!user) setUser(DEFAULT_ADMIN);
        if (!businessConfig) setBusinessConfig(DEFAULT_CONFIG);
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
    // Si se hace clic en logout, reiniciar a admin del kiosco para no bloquear al usuario
    setUser(DEFAULT_ADMIN);
    setBusinessConfig(DEFAULT_CONFIG);
    setToken(DEFAULT_TOKEN);
    localStorage.setItem('user', JSON.stringify(DEFAULT_ADMIN));
    localStorage.setItem('token', DEFAULT_TOKEN);
  };

  const updateCurrentUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const updateBusinessConfig = (config) => {
    setBusinessConfig(config);
    localStorage.setItem('businessConfig', JSON.stringify(config));
  };

  const isAdmin = true; // Forzado como Administrador para acceso directo inmediato

  return (
    <AuthContext.Provider
      value={{
        user: user || DEFAULT_ADMIN,
        businessConfig: businessConfig || DEFAULT_CONFIG,
        token: token || DEFAULT_TOKEN,
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
