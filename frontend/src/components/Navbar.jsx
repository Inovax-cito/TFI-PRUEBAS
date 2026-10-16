import React, { useState, useRef, useEffect } from 'react';
import { Menu, Bell, User, LogOut, Store, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { NotificationDropdown } from './NotificationDropdown.jsx';
import { ProfileModal } from './ProfileModal.jsx';

export const Navbar = ({ activeTab, setMobileOpen }) => {
  const { user, isAdmin, unreadNotifications, fetchUnreadCount, logout } = useAuth();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const notifRef = useRef(null);

  // Cerrar dropdown al hacer click afuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPageTitle = (tab) => {
    switch (tab) {
      case 'analyses': return 'Análisis del negocio';
      case 'portal': return 'Emprende';
      case 'business': return 'Mi negocio';
      case 'events': return 'Ferias y eventos';
      case 'applications': return 'Mis solicitudes';
      case 'market-admin': return 'Administración de eventos';
      case 'dashboard': return 'Panel Principal';
      case 'sales': return 'Punto de Venta & Operaciones';
      case 'products': return 'Catálogo de Productos';
      case 'inventory': return 'Control de Inventario';
      case 'purchases': return 'Gestión de Compras';
      case 'suppliers': return 'Directorio de Proveedores';
      case 'cash': return 'Control de Caja & Arqueo';
      case 'reports': return 'Reportes & Estadísticas';
      case 'users': return 'Gestión de Usuarios';
      case 'config': return 'Configuración del Sistema';
      default: return 'Emprende';
    }
  };

  return (
    <>
      <header className="app-navbar">
        <div className="navbar-left">
          <button
            className="nav-action-btn mobile-only"
            onClick={() => setMobileOpen(true)}
            title="Abrir menú"
            style={{ display: 'none' }}
          >
            <Menu size={20} />
          </button>

          <div className="navbar-store-info">
            <Store size={16} className="text-primary" />
            <span>Emprende · Tucumán</span>
          </div>
        </div>

        <div className="navbar-right">
          {/* Notificaciones */}
          <div style={{ position: 'relative' }} ref={notifRef}>
            <button
              className="nav-action-btn"
              onClick={() => setShowNotifications(!showNotifications)}
              title="Notificaciones"
            >
              <Bell size={18} />
              {unreadNotifications > 0 && (
                <span className="nav-badge">{unreadNotifications}</span>
              )}
            </button>

            <NotificationDropdown
              isOpen={showNotifications}
              onClose={() => setShowNotifications(false)}
              onRefreshCount={fetchUnreadCount}
            />
          </div>

          {/* Pastilla de usuario con acceso a perfil */}
          <div
            className="navbar-user-pill"
            onClick={() => setShowProfileModal(true)}
            title="Ver perfil y seguridad"
          >
            <div className="user-avatar-circle" style={{ width: '28px', height: '28px', fontSize: '0.75rem' }}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-main)' }}>
                {user?.name} {user?.lastName}
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Shield size={10} /> {user?.role}
              </span>
            </div>
          </div>

          {/* Salir */}
          <button
            className="nav-action-btn"
            onClick={logout}
            title="Cerrar sesión"
            style={{ color: '#ef4444' }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Modal de perfil */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </>
  );
};
