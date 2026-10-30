import React, { useState } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { Navbar } from './components/Navbar.jsx';

import { LoginPage } from './pages/LoginPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { SalesPage } from './pages/SalesPage.jsx';
import { ProductsPage } from './pages/ProductsPage.jsx';
import { InventoryPage } from './pages/InventoryPage.jsx';
import { PurchasesPage } from './pages/PurchasesPage.jsx';
import { SuppliersPage } from './pages/SuppliersPage.jsx';
import { CashPage } from './pages/CashPage.jsx';
import { ReportsPage } from './pages/ReportsPage.jsx';
import { UsersPage } from './pages/UsersPage.jsx';
import { ConfigPage } from './pages/ConfigPage.jsx';
import { EntrepreneurPortal, MarketplacePage } from './pages/MarketplacePage.jsx';

export function AppContent() {
  const { user, loading, isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState('portal');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg-sidebar)', color: '#ffffff', gap: '16px' }}>
        <div className="spinner-primary" style={{ width: '40px', height: '40px', borderWidth: '4px' }} />
        <span style={{ fontSize: '1rem', fontWeight: 600, color: '#94a3b8' }}>
          Iniciando Emprende…
        </span>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const marketplaceSections = { portal: 'home', business: 'business', events: 'events', applications: 'applications', 'market-admin': 'admin' };
  if (user.role === 'EMPRENDEDOR' || marketplaceSections[activeTab]) {
    return <EntrepreneurPortal initialSection={marketplaceSections[activeTab] || 'home'} onOpenBackoffice={() => setActiveTab('dashboard')} />;
  }

  // Acceso directo como Administrador de Kiosco (sin pantalla de login)

  // Renderizador de pestañas
  const renderContent = () => {
    switch (activeTab) {
      case 'portal':
        return <MarketplacePage initialTab="home" onNavigate={setActiveTab} />;
      case 'business':
        return <MarketplacePage initialTab="business" onNavigate={setActiveTab} />;
      case 'events':
        return <MarketplacePage initialTab="events" onNavigate={setActiveTab} />;
      case 'applications':
        return <MarketplacePage initialTab="applications" onNavigate={setActiveTab} />;
      case 'market-admin':
        return <MarketplacePage initialTab="admin" onNavigate={setActiveTab} />;
      case 'dashboard':
        return <DashboardPage setActiveTab={setActiveTab} />;
      case 'sales':
        return <SalesPage />;
      case 'products':
        return <ProductsPage />;
      case 'inventory':
        return <InventoryPage />;
      case 'purchases':
        return isAdmin ? <PurchasesPage /> : <DashboardPage setActiveTab={setActiveTab} />;
      case 'suppliers':
        return <SuppliersPage />;
      case 'cash':
        return <CashPage />;
      case 'reports':
        return isAdmin ? <ReportsPage /> : <DashboardPage setActiveTab={setActiveTab} />;
      case 'users':
        return isAdmin ? <UsersPage /> : <DashboardPage setActiveTab={setActiveTab} />;
      case 'config':
        return <ConfigPage />;
      default:
        return <DashboardPage setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div className={`app-main ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <Navbar
          activeTab={activeTab}
          setMobileOpen={setMobileOpen}
        />

        <main className="app-content">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
