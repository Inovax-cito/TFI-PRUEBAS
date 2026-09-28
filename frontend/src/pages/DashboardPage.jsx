import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  Package,
  AlertTriangle,
  ShoppingBag,
  Wallet,
  Clock,
  Plus,
  ShoppingCart,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { apiRequest } from '../utils/api.js';
import { formatCurrency, formatDateTime } from '../utils/formatters.js';

export const DashboardPage = ({ setActiveTab }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest('/reports/dashboard');
      setData(res);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al obtener datos del panel');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '12px' }}>
        <div className="spinner-primary" />
        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Cargando métricas en tiempo real...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px', background: '#fef2f2', borderRadius: '12px', border: '1px solid #fecaca', color: '#991b1b' }}>
        <h3 style={{ margin: '0 0 8px 0' }}>Error al cargar el panel</h3>
        <p style={{ margin: 0 }}>{error}</p>
        <button className="btn btn-secondary btn-sm mt-3" onClick={fetchDashboardData}>
          <RefreshCw size={14} /> Reintentar
        </button>
      </div>
    );
  }

  const { cards, charts, recentActivity } = data || {};

  return (
    <div>
      {/* Encabezado y acciones rápidas */}
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            <TrendingUp size={24} className="text-primary" /> Panel de Control Comercial
          </h1>
          <p className="page-subtitle">
            Resumen en vivo del estado económico, inventario y flujo de caja
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={fetchDashboardData} title="Actualizar datos">
            <RefreshCw size={16} /> Actualizar
          </button>
          <button className="btn btn-primary" onClick={() => setActiveTab('sales')}>
            <ShoppingCart size={16} /> Nueva Venta
          </button>
        </div>
      </div>

      {/* Grid de Métricas Principales (8 tarjetas requeridas) */}
      <div className="metrics-grid">
        {/* 1. Ventas del día */}
        <div className="metric-card">
          <div className="metric-content">
            <span className="metric-label">Ventas del Día</span>
            <span className="metric-value">{formatCurrency(cards?.salesTodayTotal)}</span>
            <span className="metric-subtext">
              <CheckCircle size={13} className="text-success" /> {cards?.salesTodayCount || 0} operaciones concretadas
            </span>
          </div>
          <div className="metric-icon-box icon-blue">
            <ShoppingCart size={22} />
          </div>
        </div>

        {/* 2. Ingresos del día */}
        <div className="metric-card">
          <div className="metric-content">
            <span className="metric-label">Ingresos de Caja Hoy</span>
            <span className="metric-value text-success">{formatCurrency(cards?.todayIncomes)}</span>
            <span className="metric-subtext">
              <ArrowUpRight size={13} className="text-success" /> Cobranzas en efectivo
            </span>
          </div>
          <div className="metric-icon-box icon-green">
            <ArrowUpRight size={22} />
          </div>
        </div>

        {/* 3. Egresos del día */}
        <div className="metric-card">
          <div className="metric-content">
            <span className="metric-label">Egresos de Caja Hoy</span>
            <span className="metric-value text-danger">{formatCurrency(cards?.todayExpenses)}</span>
            <span className="metric-subtext">
              <ArrowDownRight size={13} className="text-danger" /> Pagos y retiros
            </span>
          </div>
          <div className="metric-icon-box icon-red">
            <ArrowDownRight size={22} />
          </div>
        </div>

        {/* 4. Ganancia estimada */}
        <div className="metric-card">
          <div className="metric-content">
            <span className="metric-label">Ganancia Bruta Hoy</span>
            <span className="metric-value" style={{ color: cards?.estimatedProfitToday >= 0 ? '#10b981' : '#ef4444' }}>
              {formatCurrency(cards?.estimatedProfitToday)}
            </span>
            <span className="metric-subtext">
              Ventas netas menos costos directos
            </span>
          </div>
          <div className="metric-icon-box icon-green">
            <TrendingUp size={22} />
          </div>
        </div>

        {/* 5. Cantidad de productos */}
        <div className="metric-card">
          <div className="metric-content">
            <span className="metric-label">Productos Activos</span>
            <span className="metric-value">{cards?.totalProducts || 0}</span>
            <span className="metric-subtext" style={{ cursor: 'pointer', color: 'var(--color-primary)' }} onClick={() => setActiveTab('products')}>
              Ver catálogo completo &rarr;
            </span>
          </div>
          <div className="metric-icon-box icon-slate">
            <Package size={22} />
          </div>
        </div>

        {/* 6. Productos con stock bajo */}
        <div className="metric-card" style={{ borderColor: cards?.lowStockCount > 0 ? '#fde68a' : undefined }}>
          <div className="metric-content">
            <span className="metric-label">Stock en Alerta</span>
            <span className="metric-value" style={{ color: cards?.lowStockCount > 0 ? '#d97706' : '#1e293b' }}>
              {cards?.lowStockCount || 0}
            </span>
            <span className="metric-subtext" style={{ color: cards?.lowStockCount > 0 ? '#d97706' : undefined, cursor: 'pointer' }} onClick={() => setActiveTab('inventory')}>
              <AlertTriangle size={13} /> {cards?.lowStockCount > 0 ? 'Requieren reposición' : 'Existencias óptimas'}
            </span>
          </div>
          <div className="metric-icon-box icon-amber">
            <AlertTriangle size={22} />
          </div>
        </div>

        {/* 7. Compras pendientes */}
        <div className="metric-card">
          <div className="metric-content">
            <span className="metric-label">Compras Pendientes</span>
            <span className="metric-value">{cards?.pendingPurchasesCount || 0}</span>
            <span className="metric-subtext" style={{ cursor: 'pointer', color: 'var(--color-primary)' }} onClick={() => setActiveTab('purchases')}>
              Por recibir mercadería &rarr;
            </span>
          </div>
          <div className="metric-icon-box icon-blue">
            <ShoppingBag size={22} />
          </div>
        </div>

        {/* 8. Estado actual de la caja */}
        <div className="metric-card">
          <div className="metric-content">
            <span className="metric-label">Estado de Caja</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              <span className={`badge ${cards?.cashStatus?.isOpen ? 'badge-success' : 'badge-danger'}`}>
                {cards?.cashStatus?.isOpen ? 'ABIERTA' : 'CERRADA'}
              </span>
              <span style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                {formatCurrency(cards?.cashStatus?.currentBalance)}
              </span>
            </div>
            <span className="metric-subtext" style={{ cursor: 'pointer', color: 'var(--color-primary)' }} onClick={() => setActiveTab('cash')}>
              Ir a arqueo y movimientos &rarr;
            </span>
          </div>
          <div className="metric-icon-box icon-green">
            <Wallet size={22} />
          </div>
        </div>
      </div>

      {/* Sección de Gráficos Interactivos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Gráfico 1: Ventas últimos 7 días */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <TrendingUp size={18} className="text-primary" /> Evolución de Ventas (Últimos 7 Días)
            </h3>
          </div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={charts?.last7Days || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(value), 'Total Vendido']}
                  labelFormatter={(label) => `Fecha: ${label}`}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
                />
                <Area type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Top 5 productos más vendidos */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Package size={18} className="text-primary" /> Productos Más Vendidos (Unidades)
            </h3>
          </div>
          <div style={{ width: '100%', height: 260 }}>
            {charts?.topProducts?.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: '0.9rem' }}>
                No hay ventas registradas para graficar productos.
              </div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={charts?.topProducts || []} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#475569"
                    fontSize={11}
                    tickLine={false}
                    width={130}
                    tickFormatter={(val) => (val.length > 18 ? `${val.substring(0, 16)}...` : val)}
                  />
                  <Tooltip
                    formatter={(value) => [`${value} unidades`, 'Cantidad']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="quantity" fill="#10b981" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Actividad Reciente */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <Clock size={18} className="text-primary" /> Actividad Reciente del Sistema
          </h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
            Últimas operaciones comerciales registradas
          </span>
        </div>

        {recentActivity?.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No hay actividad registrada recientemente.</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>TIPO</th>
                  <th>OPERACIÓN</th>
                  <th>DETALLES</th>
                  <th>RESPONSABLE</th>
                  <th>FECHA Y HORA</th>
                  <th>ESTADO</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((act) => (
                  <tr key={act.id}>
                    <td>
                      <span className={`badge ${act.type === 'VENTA' ? 'badge-primary' : 'badge-warning'}`}>
                        {act.type}
                      </span>
                    </td>
                    <td><strong>{act.title}</strong></td>
                    <td>{act.description}</td>
                    <td>{act.userName}</td>
                    <td>{formatDateTime(act.createdAt)}</td>
                    <td>
                      <span className={`badge ${act.status === 'COMPLETADA' || act.status === 'RECIBIDA' ? 'badge-success' : act.status === 'PENDIENTE' ? 'badge-warning' : 'badge-danger'}`}>
                        {act.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
