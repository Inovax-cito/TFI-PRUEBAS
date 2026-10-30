import React, { useState, useEffect } from 'react';
import {
  Boxes,
  PlusCircle,
  MinusCircle,
  AlertTriangle,
  History,
  Search,
  Filter,
  Package,
  DollarSign,
  TrendingDown,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { apiRequest } from '../utils/api.js';
import { formatCurrency, formatDateTime } from '../utils/formatters.js';
import { useAuth } from '../context/AuthContext.jsx';

export const InventoryPage = () => {
  const { isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState('stock'); // 'stock' | 'movements' | 'alerts'

  // Resumen
  const [summary, setSummary] = useState(null);

  // Existencias
  const [products, setProducts] = useState([]);
  const [stockSearch, setStockSearch] = useState('');
  const [stockLoading, setStockLoading] = useState(true);

  // Movimientos
  const [movements, setMovements] = useState([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementTypeFilter, setMovementTypeFilter] = useState('');
  const [movementPage, setMovementPage] = useState(1);
  const [movementTotalPages, setMovementTotalPages] = useState(1);

  // Alertas
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  // Modal Ajuste de Inventario
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [selectedProductForAdjustment, setSelectedProductForAdjustment] = useState(null);
  const [adjustmentType, setAdjustmentType] = useState('AJUSTE_POSITIVO');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState('1');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [adjustmentError, setAdjustmentError] = useState(null);

  useEffect(() => {
    fetchSummary();
    fetchStock();
  }, [stockSearch]);

  useEffect(() => {
    if (activeTab === 'movements') {
      fetchMovements();
    } else if (activeTab === 'alerts') {
      fetchAlerts();
    }
  }, [activeTab, movementTypeFilter, movementPage]);

  const fetchSummary = async () => {
    try {
      const res = await apiRequest('/inventory/summary');
      setSummary(res);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStock = async () => {
    try {
      setStockLoading(true);
      const res = await apiRequest(`/products?search=${stockSearch}`);
      setProducts(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setStockLoading(false);
    }
  };

  const fetchMovements = async () => {
    try {
      setMovementsLoading(true);
      const query = new URLSearchParams({
        page: movementPage,
        limit: 15,
        ...(movementTypeFilter && { type: movementTypeFilter }),
      });
      const res = await apiRequest(`/inventory/movements?${query.toString()}`);
      setMovements(res.movements || []);
      setMovementTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setMovementsLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      setAlertsLoading(true);
      const res = await apiRequest('/inventory/low-stock');
      setLowStockProducts(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setAlertsLoading(false);
    }
  };

  const handleOpenAdjustment = (prod) => {
    setSelectedProductForAdjustment(prod);
    setAdjustmentType('AJUSTE_POSITIVO');
    setAdjustmentQuantity('1');
    setAdjustmentReason('');
    setAdjustmentError(null);
    setShowAdjustmentModal(true);
  };

  const handleSaveAdjustment = async (e) => {
    e.preventDefault();
    setAdjustmentError(null);
    setAdjusting(true);

    try {
      await apiRequest('/inventory/adjustments', {
        method: 'POST',
        body: {
          productId: selectedProductForAdjustment.id,
          type: adjustmentType,
          quantity: parseInt(adjustmentQuantity, 10),
          reason: adjustmentReason,
        },
      });

      setShowAdjustmentModal(false);
      fetchSummary();
      fetchStock();
      if (activeTab === 'movements') fetchMovements();
      if (activeTab === 'alerts') fetchAlerts();
    } catch (err) {
      setAdjustmentError(err.message || 'Error al procesar el ajuste');
    } finally {
      setAdjusting(false);
    }
  };

  const getMovementBadge = (type) => {
    switch (type) {
      case 'INGRESO_COMPRA':
        return <span className="badge badge-success">Ingreso por Compra</span>;
      case 'SALIDA_VENTA':
        return <span className="badge badge-primary">Salida por Venta</span>;
      case 'AJUSTE_POSITIVO':
        return <span className="badge badge-success">Ajuste (+)</span>;
      case 'AJUSTE_NEGATIVO':
        return <span className="badge badge-danger">Ajuste (-)</span>;
      case 'DEVOLUCION':
        return <span className="badge badge-warning">Devolución</span>;
      default:
        return <span className="badge badge-neutral">{type}</span>;
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            <Boxes size={24} className="text-primary" /> Inventario
          </h1>
          <p className="page-subtitle">
            Seguimiento de stock en tiempo real, ajustes físicos y alertas automáticas de reposición
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`btn ${activeTab === 'stock' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('stock')}
          >
            <Boxes size={16} /> Stock actual
          </button>
          <button
            className={`btn ${activeTab === 'movements' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('movements')}
          >
            <History size={16} /> Movimientos (Kardex)
          </button>
          <button
            className={`btn ${activeTab === 'alerts' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('alerts')}
          >
            <AlertTriangle size={16} /> Alertas de reposición ({summary?.lowStockCount || 0})
          </button>
        </div>
      </div>

      {/* Tarjetas de Resumen de Inventario */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-content">
            <span className="metric-label">Valorización a Costo</span>
            <span className="metric-value">{formatCurrency(summary?.totalValuationCost)}</span>
            <span className="metric-subtext">Capital inmovilizado en stock</span>
          </div>
          <div className="metric-icon-box icon-slate">
            <DollarSign size={20} />
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-content">
            <span className="metric-label">Valorización a Venta</span>
            <span className="metric-value text-primary">{formatCurrency(summary?.totalValuationSale)}</span>
            <span className="metric-subtext">Proyección de ingresos brutos</span>
          </div>
          <div className="metric-icon-box icon-blue">
            <Package size={20} />
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-content">
            <span className="metric-label">Ganancia Proyectada</span>
            <span className="metric-value text-success">{formatCurrency(summary?.potentialProfit)}</span>
            <span className="metric-subtext">Margen total del inventario</span>
          </div>
          <div className="metric-icon-box icon-green">
            <DollarSign size={20} />
          </div>
        </div>

        <div className="metric-card" style={{ borderColor: summary?.lowStockCount > 0 ? '#fde68a' : undefined }}>
          <div className="metric-content">
            <span className="metric-label">Productos en Alerta</span>
            <span className="metric-value" style={{ color: summary?.lowStockCount > 0 ? '#d97706' : '#10b981' }}>
              {summary?.lowStockCount || 0}
            </span>
            <span className="metric-subtext" style={{ color: summary?.lowStockCount > 0 ? '#d97706' : undefined }}>
              {summary?.outOfStockCount || 0} agotados totalmente
            </span>
          </div>
          <div className="metric-icon-box icon-amber">
            <AlertTriangle size={20} />
          </div>
        </div>
      </div>

      {/* PESTAÑA 1: STOCK ACTUAL */}
      {activeTab === 'stock' && (
        <div className="card">
          <div className="filters-bar">
            <div className="search-input-wrapper" style={{ maxWidth: '340px' }}>
              <Search size={16} className="search-icon-prefix" />
              <input
                type="text"
                className="form-input search-input"
                placeholder="Buscar por código SKU o producto..."
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
              />
            </div>
            <button className="btn btn-secondary btn-icon" onClick={fetchStock} title="Recargar">
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>PRODUCTO</th>
                  <th>CATEGORÍA</th>
                  <th>STOCK ACTUAL</th>
                  <th>STOCK MÍNIMO</th>
                  <th>VALORIZACIÓN COSTO</th>
                  <th>ESTADO</th>
                  {isAdmin && <th style={{ textAlign: 'right' }}>AJUSTE</th>}
                </tr>
              </thead>
              <tbody>
                {stockLoading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '30px' }}>
                      Cargando existencias...
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                      No se encontraron productos.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => {
                    const isOutOfStock = p.currentStock <= 0;
                    const isLow = p.currentStock <= p.minStock && !isOutOfStock;
                    const valCost = p.currentStock * Number(p.purchasePrice);

                    return (
                      <tr key={p.id}>
                        <td style={{ fontFamily: 'monospace' }}>{p.sku}</td>
                        <td><strong>{p.name}</strong></td>
                        <td><span className="badge badge-neutral">{p.category?.name || 'General'}</span></td>
                        <td>
                          <span style={{ fontSize: '1rem', fontWeight: 700, color: isOutOfStock ? '#dc2626' : isLow ? '#d97706' : 'var(--color-text-main)' }}>
                            {p.currentStock} {p.unit}
                          </span>
                        </td>
                        <td>{p.minStock} {p.unit}</td>
                        <td>{formatCurrency(valCost)}</td>
                        <td>
                          <span className={`badge ${isOutOfStock ? 'badge-danger' : isLow ? 'badge-warning' : 'badge-success'}`}>
                            {isOutOfStock ? 'Agotado' : isLow ? 'Stock Bajo' : 'Normal'}
                          </span>
                        </td>
                        {isAdmin && (
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleOpenAdjustment(p)}
                              title="Ajustar stock físico"
                            >
                              <PlusCircle size={14} /> Ajustar
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: MOVIMIENTOS (KARDEX) */}
      {activeTab === 'movements' && (
        <div className="card">
          <div className="filters-bar">
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                className="form-select"
                style={{ width: 'auto' }}
                value={movementTypeFilter}
                onChange={(e) => { setMovementTypeFilter(e.target.value); setMovementPage(1); }}
              >
                <option value="">Todos los tipos de movimiento</option>
                <option value="INGRESO_COMPRA">Ingreso por Compra</option>
                <option value="SALIDA_VENTA">Salida por Venta</option>
                <option value="AJUSTE_POSITIVO">Ajuste Positivo (+)</option>
                <option value="AJUSTE_NEGATIVO">Ajuste Negativo (-)</option>
                <option value="DEVOLUCION">Devolución</option>
              </select>
            </div>

            <button className="btn btn-secondary btn-icon" onClick={fetchMovements} title="Recargar">
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>FECHA Y HORA</th>
                  <th>PRODUCTO</th>
                  <th>TIPO</th>
                  <th>CANTIDAD</th>
                  <th>STOCK PREVIO</th>
                  <th>STOCK RESULTANTE</th>
                  <th>MOTIVO / CONCEPTO</th>
                  <th>RESPONSABLE</th>
                </tr>
              </thead>
              <tbody>
                {movementsLoading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '30px' }}>
                      Cargando movimientos de inventario...
                    </td>
                  </tr>
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                      No se encontraron movimientos registrados.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => {
                    const isPositive = ['INGRESO_COMPRA', 'AJUSTE_POSITIVO', 'DEVOLUCION'].includes(m.type);

                    return (
                      <tr key={m.id}>
                        <td>{formatDateTime(m.createdAt)}</td>
                        <td><strong>{m.product?.name}</strong></td>
                        <td>{getMovementBadge(m.type)}</td>
                        <td>
                          <span style={{ fontWeight: 700, color: isPositive ? '#16a34a' : '#dc2626' }}>
                            {isPositive ? `+${m.quantity}` : `-${m.quantity}`}
                          </span>
                        </td>
                        <td style={{ color: '#64748b' }}>{m.previousStock}</td>
                        <td><strong>{m.resultStock}</strong></td>
                        <td>{m.reason || '-'}</td>
                        <td>{m.user ? `${m.user.name} ${m.user.lastName}` : 'Sistema'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="pagination-bar">
            <span>Página {movementPage} de {movementTotalPages}</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={movementPage <= 1}
                onClick={() => setMovementPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={movementPage >= movementTotalPages}
                onClick={() => setMovementPage((p) => p + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 3: ALERTAS DE REPOSICIÓN */}
      {activeTab === 'alerts' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title text-warning">
              <AlertTriangle size={18} /> Artículos que requieren reabastecimiento urgente
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={fetchAlerts}>
              <RefreshCw size={14} /> Actualizar
            </button>
          </div>

          {alertsLoading ? (
            <div style={{ textAlign: 'center', padding: '30px' }}>Consultando alertas...</div>
          ) : lowStockProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#16a34a' }}>
              <CheckCircle2 size={32} style={{ margin: '0 auto 8px auto' }} />
              <p style={{ fontWeight: 600 }}>¡Inventario en estado óptimo!</p>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                No existen productos con stock igual o inferior a su punto mínimo de reposición.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>PRODUCTO</th>
                    <th>CATEGORÍA</th>
                    <th>STOCK ACTUAL</th>
                    <th>STOCK MÍNIMO</th>
                    <th>FALTANTE SUGERIDO</th>
                    {isAdmin && <th style={{ textAlign: 'right' }}>ACCIÓN RÁPIDA</th>}
                  </tr>
                </thead>
                <tbody>
                  {lowStockProducts.map((p) => {
                    const suggestedRefill = Math.max(0, p.minStock * 2 - p.currentStock);
                    return (
                      <tr key={p.id}>
                        <td style={{ fontFamily: 'monospace' }}>{p.sku}</td>
                        <td><strong>{p.name}</strong></td>
                        <td><span className="badge badge-neutral">{p.category?.name}</span></td>
                        <td>
                          <span className={`badge ${p.currentStock <= 0 ? 'badge-danger' : 'badge-warning'}`}>
                            {p.currentStock} {p.unit}
                          </span>
                        </td>
                        <td>{p.minStock} {p.unit}</td>
                        <td><strong>+{suggestedRefill} {p.unit}</strong></td>
                        {isAdmin && (
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleOpenAdjustment(p)}
                            >
                              <PlusCircle size={14} /> Ajustar Stock
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Ajuste de Inventario */}
      {showAdjustmentModal && selectedProductForAdjustment && (
        <div className="modal-overlay" onClick={() => setShowAdjustmentModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                <Boxes size={20} className="text-primary" /> Ajuste Manual de Inventario
              </h2>
              <button className="modal-close-btn" onClick={() => setShowAdjustmentModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment}>
              <div className="modal-body">
                {adjustmentError && (
                  <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#991b1b', borderRadius: '8px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                    <AlertCircle size={18} /> {adjustmentError}
                  </div>
                )}

                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>PRODUCTO SELECCIONADO</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                    {selectedProductForAdjustment.name}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '2px' }}>
                    Stock registrado actual: <strong>{selectedProductForAdjustment.currentStock} {selectedProductForAdjustment.unit}</strong>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Tipo de Ajuste *</label>
                  <select
                    className="form-select"
                    value={adjustmentType}
                    onChange={(e) => setAdjustmentType(e.target.value)}
                  >
                    <option value="AJUSTE_POSITIVO">Ajuste Positivo (+) — Incrementa existencias</option>
                    <option value="AJUSTE_NEGATIVO">Ajuste Negativo (-) — Reduce existencias por merma, rotura o pérdida</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Cantidad a Modificar *</label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    value={adjustmentQuantity}
                    onChange={(e) => setAdjustmentQuantity(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Motivo o Justificación Obligatoria *</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="ej: Recuento físico semanal, mercadería dañada durante traslado..."
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdjustmentModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={adjusting}>
                  {adjusting ? 'Aplicando...' : 'Confirmar Ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
