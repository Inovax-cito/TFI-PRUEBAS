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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  LabelList,
} from 'recharts';
import { apiRequest } from '../utils/api.js';
import { formatCurrency, formatDateTime } from '../utils/formatters.js';
import { CHART, TOOLTIP_STYLE, shortMoney } from '../utils/chartTheme.js';

export const DashboardPage = ({ setActiveTab }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    try {
      setError(null);
      const res = await apiRequest('/reports/dashboard');
      setData(res);
    } catch (err) {
      setError(err.message || 'No se pudo cargar el panel comercial.');
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
  const last7Days = charts?.last7Days || [];
  const topProducts = charts?.topProducts || [];
  const weekTotal = last7Days.reduce((sum, day) => sum + Number(day.total || 0), 0);

  return (
    <div>
      {/* Encabezado y acciones rápidas */}
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            <TrendingUp size={24} className="text-primary" /> Panel comercial
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
            <ShoppingCart size={16} /> Nueva venta
          </button>
        </div>
      </div>

      {/* Grid de Métricas Principales (8 tarjetas requeridas) */}
      <div className="metrics-grid">
        {/* 1. Ventas del día */}
        <div className="metric-card">
          <div className="metric-content">
            <span className="metric-label">Ventas de hoy</span>
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
            <span className="metric-label">Ingresos de caja hoy</span>
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
            <span className="metric-label">Egresos de caja hoy</span>
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
            <span className="metric-label">Ganancia bruta hoy</span>
            <span className="metric-value" style={{ color: cards?.estimatedProfitToday >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
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
            <span className="metric-label">Productos activos</span>
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
            <span className="metric-label">Stock bajo</span>
            <span className="metric-value" style={{ color: cards?.lowStockCount > 0 ? 'var(--color-warning)' : 'var(--color-text-main)' }}>
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
            <span className="metric-label">Compras pendientes</span>
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
            <span className="metric-label">Estado de la caja</span>
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

      {/* Sección de Gráficos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Gráfico 1: Ventas últimos 7 días */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <TrendingUp size={18} className="text-primary" /> Ventas de los últimos 7 días
            </h3>
          </div>
          <p className="chart-help">
            Cada barra es el total cobrado en un día. Total de la semana: <strong>{formatCurrency(weekTotal)}</strong>
          </p>
          <div style={{ width: '100%', height: 250 }}>
            {weekTotal === 0 ? (
              <div className="chart-empty">
                <TrendingUp size={22} />
                <strong>Sin ventas en los últimos 7 días</strong>
                <span>Cuando registres ventas desde “Ventas”, vas a ver acá cuánto se vendió cada día.</span>
              </div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={last7Days} margin={{ top: 22, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="label" stroke={CHART.axis} fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke={CHART.axis}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={shortMoney}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(0, 140, 145, 0.06)' }}
                    formatter={(value, _name, item) => [`${formatCurrency(value)} (${item.payload.count || 0} ventas)`, 'Vendido']}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Bar dataKey="total" fill={CHART.primary} radius={[6, 6, 0, 0]} maxBarSize={44}>
                    <LabelList dataKey="total" position="top" formatter={(v) => (v > 0 ? shortMoney(v) : '')} fontSize={11} fill={CHART.label} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Gráfico 2: Top 5 productos más vendidos */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Package size={18} className="text-primary" /> Productos más vendidos
            </h3>
          </div>
          <p className="chart-help">Los 5 productos con más unidades vendidas. El número indica cuántas unidades salieron.</p>
          <div style={{ width: '100%', height: 250 }}>
            {topProducts.length === 0 ? (
              <div className="chart-empty">
                <Package size={22} />
                <strong>Todavía no hay productos vendidos</strong>
                <span>El ranking se arma automáticamente con cada venta.</span>
              </div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke={CHART.label}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={200}
                    tickFormatter={(val) => (val.length > 28 ? `${val.substring(0, 27)}…` : val)}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(0, 140, 145, 0.06)' }}
                    formatter={(value, _name, item) => [`${value} unidades · ${formatCurrency(item.payload.total)}`, 'Vendido']}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Bar dataKey="quantity" fill={CHART.primary} radius={[0, 6, 6, 0]} barSize={22}>
                    <LabelList dataKey="quantity" position="right" formatter={(v) => `${v} u.`} fontSize={12} fontWeight={700} fill={CHART.label} />
                  </Bar>
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
            <Clock size={18} className="text-primary" /> Actividad reciente
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
