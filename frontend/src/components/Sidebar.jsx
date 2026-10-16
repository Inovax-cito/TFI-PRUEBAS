import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Truck,
  Building2,
  Wallet,
  BarChart3,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Store,
  ClipboardList,
  Compass,
  TicketCheck,
  BriefcaseBusiness,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export const Sidebar = ({
  activeTab,
  setActiveTab,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}) => {
  const { user, isAdmin, logout, unreadNotifications } = useAuth();
  const isEntrepreneur = user?.role === 'EMPRENDEDOR';

  const navItems = [
    { id: 'portal', label: 'Inicio', icon: LayoutDashboard, adminOnly: false },
    { id: 'business', label: 'Mi negocio', icon: BriefcaseBusiness, adminOnly: false },
    { id: 'events', label: 'Ferias y eventos', icon: Compass, adminOnly: false },
    { id: 'applications', label: 'Mis solicitudes', icon: TicketCheck, adminOnly: false },
    { id: 'market-admin', label: 'Administración', icon: ClipboardList, adminOnly: true },
    { id: 'dashboard', label: 'Panel comercial', icon: BarChart3, adminOnly: false, staffOnly: true },
    { id: 'sales', label: 'Ventas', icon: ShoppingCart, adminOnly: false, staffOnly: true },
    { id: 'products', label: 'Productos', icon: Package, adminOnly: false, staffOnly: true },
    { id: 'inventory', label: 'Inventario', icon: Boxes, adminOnly: false, staffOnly: true },
    { id: 'purchases', label: 'Compras', icon: Truck, adminOnly: true, staffOnly: true },
    { id: 'suppliers', label: 'Proveedores', icon: Building2, adminOnly: false, staffOnly: true },
    { id: 'cash', label: 'Caja', icon: Wallet, adminOnly: false, staffOnly: true },
    { id: 'reports', label: 'Reportes', icon: BarChart3, adminOnly: true, staffOnly: true },
    { id: 'users', label: 'Usuarios', icon: Users, adminOnly: true, staffOnly: true },
    { id: 'config', label: 'Configuración', icon: Settings, adminOnly: false, staffOnly: true },
  ];

  const visibleItems = navItems.filter((item) => (!item.adminOnly || isAdmin) && (!item.staffOnly || !isEntrepreneur));

  const handleItemClick = (id) => {
    setActiveTab(id);
    if (setMobileOpen) setMobileOpen(false);
  };

  return (
    <>
      {/* Overlay para móviles */}
      <div
        className={`sidebar-overlay ${mobileOpen ? 'active' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-icon-box">
              <Store size={20} />
            </div>
            {!collapsed && (
              <div className="brand-text">
                <span className="brand-title">Emprende</span>
                <span className="brand-subtitle">Negocios y eventos</span>
              </div>
            )}
          </div>
          <button
            className="sidebar-toggle-btn no-mobile"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expandir barra' : 'Contraer barra'}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleItemClick(item.id)}
                title={collapsed ? item.label : undefined}
              >
                <div className="sidebar-item-icon">
                  <Icon size={19} />
                </div>
                {!collapsed && <span className="sidebar-item-label">{item.label}</span>}
                {!collapsed && item.id === 'inventory' && unreadNotifications > 0 && (
                  <span className="sidebar-badge">{unreadNotifications}</span>
                )}
              </button>
            );
          })}

          <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
            <button
              className="sidebar-nav-item"
              onClick={logout}
              style={{ color: '#f87171' }}
              title={collapsed ? 'Cerrar sesión' : undefined}
            >
              <div className="sidebar-item-icon">
                <LogOut size={19} />
              </div>
              {!collapsed && <span className="sidebar-item-label">Cerrar sesión</span>}
            </button>
          </div>
        </nav>

        {!collapsed && (
          <div className="sidebar-footer">
            <div className="sidebar-user-card">
              <div className="user-avatar-circle">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">
                  {user?.name} {user?.lastName}
                </div>
                <div className="sidebar-user-role">
                  <span className={`badge ${isAdmin ? 'badge-primary' : 'badge-neutral'}`} style={{ padding: '1px 6px', fontSize: '0.65rem' }}>
                    {user?.role}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
