import React, { useState, useEffect } from 'react';
import {
  Package,
  Search,
  Plus,
  Edit,
  History,
  Power,
  AlertTriangle,
  X,
  CheckCircle2,
  AlertCircle,
  Tag,
  ArrowUpDown,
} from 'lucide-react';
import { apiRequest } from '../utils/api.js';
import { formatCurrency, formatDateTime } from '../utils/formatters.js';
import { useAuth } from '../context/AuthContext.jsx';

export const ProductsPage = () => {
  const { isAdmin } = useAuth();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros y orden
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // Modal Crear / Editar
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    categoryId: '',
    purchasePrice: '',
    salePrice: '',
    currentStock: '0',
    minStock: '5',
    unit: 'unidad',
  });
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Modal Historial de Precios
  const [showPriceHistoryModal, setShowPriceHistoryModal] = useState(false);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [search, selectedCategory, statusFilter, sortBy, sortOrder]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        ...(search && { search }),
        ...(selectedCategory && { categoryId: selectedCategory }),
        ...(statusFilter !== '' && { active: statusFilter }),
        sortBy,
        order: sortOrder,
      });
      const res = await apiRequest(`/products?${query.toString()}`);
      setProducts(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await apiRequest('/categories?activeOnly=true');
      setCategories(res || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      sku: '',
      description: '',
      categoryId: categories[0]?.id || '',
      purchasePrice: '',
      salePrice: '',
      currentStock: '0',
      minStock: '5',
      unit: 'unidad',
    });
    setFormError(null);
    setShowFormModal(true);
  };

  const handleOpenEdit = (prod) => {
    setEditingProduct(prod);
    setFormData({
      name: prod.name,
      sku: prod.sku,
      description: prod.description || '',
      categoryId: prod.categoryId,
      purchasePrice: String(prod.purchasePrice),
      salePrice: String(prod.salePrice),
      currentStock: String(prod.currentStock),
      minStock: String(prod.minStock),
      unit: prod.unit || 'unidad',
    });
    setFormError(null);
    setShowFormModal(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    try {
      if (editingProduct) {
        // Actualizar
        await apiRequest(`/products/${editingProduct.id}`, {
          method: 'PUT',
          body: formData,
        });
      } else {
        // Crear
        await apiRequest('/products', {
          method: 'POST',
          body: formData,
        });
      }
      setShowFormModal(false);
      fetchProducts();
    } catch (err) {
      setFormError(err.message || 'Error al guardar producto');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (prod) => {
    try {
      await apiRequest(`/products/${prod.id}/toggle-status`, { method: 'PATCH' });
      fetchProducts();
    } catch (err) {
      alert(err.message || 'Error al cambiar estado');
    }
  };

  const handleViewPriceHistory = async (prod) => {
    setSelectedProductForHistory(prod);
    setShowPriceHistoryModal(true);
    setHistoryLoading(true);

    try {
      const res = await apiRequest(`/products/${prod.id}/price-history`);
      setPriceHistory(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            <Package size={24} className="text-primary" /> Productos
          </h1>
          <p className="page-subtitle">
            Gestión integral de artículos, precios, códigos de barra y márgenes
          </p>
        </div>

        {isAdmin && (
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={18} /> Registrar Nuevo Producto
          </button>
        )}
      </div>

      {/* Barra de Filtros */}
      <div className="card" style={{ marginBottom: '18px' }}>
        <div className="filters-bar" style={{ marginBottom: 0 }}>
          <div className="search-input-wrapper" style={{ maxWidth: '320px' }}>
            <Search size={16} className="search-icon-prefix" />
            <input
              type="text"
              className="form-input search-input"
              placeholder="Buscar por nombre, SKU o código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select
              className="form-select"
              style={{ width: 'auto' }}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">Todas las Categorías</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <select
              className="form-select"
              style={{ width: 'auto' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Todos los estados</option>
              <option value="true">Solo Activos</option>
              <option value="false">Solo Inactivos</option>
            </select>

            <select
              className="form-select"
              style={{ width: 'auto' }}
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('-');
                setSortBy(sb);
                setSortOrder(so);
              }}
            >
              <option value="name-asc">Nombre (A-Z)</option>
              <option value="name-desc">Nombre (Z-A)</option>
              <option value="salePrice-asc">Precio de Venta (Menor a Mayor)</option>
              <option value="salePrice-desc">Precio de Venta (Mayor a Menor)</option>
              <option value="currentStock-asc">Stock (Menor a Mayor)</option>
              <option value="currentStock-desc">Stock (Mayor a Menor)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de Productos */}
      <div className="card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>CÓDIGO / SKU</th>
                <th>NOMBRE Y DESCRIPCIÓN</th>
                <th>CATEGORÍA</th>
                <th>COSTO</th>
                <th>PRECIO VENTA</th>
                <th>MARGEN</th>
                <th>STOCK ACTUAL</th>
                <th>ESTADO</th>
                <th style={{ textAlign: 'right' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '30px' }}>
                    Cargando productos...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    No se encontraron productos registrados.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const cost = Number(p.purchasePrice);
                  const sale = Number(p.salePrice);
                  const marginPct = cost > 0 ? (((sale - cost) / cost) * 100).toFixed(0) : 0;
                  const isOutOfStock = p.currentStock <= 0;
                  const isLow = p.currentStock <= p.minStock && !isOutOfStock;

                  return (
                    <tr key={p.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#475569' }}>
                        {p.sku}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>{p.name}</div>
                        {p.description && (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{p.description}</div>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-neutral">{p.category?.name || 'General'}</span>
                      </td>
                      <td>{formatCurrency(cost)}</td>
                      <td>
                        <strong style={{ color: 'var(--color-primary)' }}>{formatCurrency(sale)}</strong>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: marginPct > 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                          +{marginPct}%
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${isOutOfStock ? 'badge-danger' : isLow ? 'badge-warning' : 'badge-success'}`}>
                          {p.currentStock} {p.unit}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${p.active ? 'badge-success' : 'badge-danger'}`}>
                          {p.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleViewPriceHistory(p)}
                            title="Ver historial de precios"
                          >
                            <History size={14} />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleOpenEdit(p)}
                                title="Editar producto"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                className={`btn btn-sm ${p.active ? 'btn-outline-danger' : 'btn-success'}`}
                                onClick={() => handleToggleStatus(p)}
                                title={p.active ? 'Desactivar producto (Baja lógica)' : 'Reactivar producto'}
                              >
                                <Power size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear / Editar Producto */}
      {showFormModal && (
        <div className="modal-overlay" onClick={() => setShowFormModal(false)}>
          <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                <Package size={20} className="text-primary" />
                {editingProduct ? `Modificar Producto: ${editingProduct.name}` : 'Registrar Nuevo Producto'}
              </h2>
              <button className="modal-close-btn" onClick={() => setShowFormModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                    <AlertCircle size={18} /> {formError}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Nombre del Producto *</label>
                    <input
                      className="form-input"
                      placeholder="ej: Yerba Mate Playadito 500g"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Código / SKU / Código de Barras *</label>
                    <input
                      className="form-input"
                      placeholder="ej: 7790070411211"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Descripción Detallada</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="Detalles sobre presentación, sabor o especificaciones..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Categoría *</label>
                    <select
                      className="form-select"
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      required
                    >
                      <option value="">Seleccione una categoría</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Unidad de Medida</label>
                    <select
                      className="form-select"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    >
                      <option value="unidad">Unidad</option>
                      <option value="paquete">Paquete</option>
                      <option value="botella">Botella</option>
                      <option value="lata">Lata</option>
                      <option value="kg">Kilogramo (kg)</option>
                      <option value="litro">Litro</option>
                      <option value="pieza">Pieza</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Precio de Costo (Compra) $ *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      placeholder="0.00"
                      value={formData.purchasePrice}
                      onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Precio de Venta al Público $ *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      placeholder="0.00"
                      value={formData.salePrice}
                      onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {!editingProduct && (
                    <div className="form-group">
                      <label className="form-label">Stock Inicial de Apertura</label>
                      <input
                        type="number"
                        min="0"
                        className="form-input"
                        value={formData.currentStock}
                        onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Stock Mínimo para Alerta de Reposición</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      value={formData.minStock}
                      onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowFormModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : editingProduct ? 'Actualizar Producto' : 'Crear Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Historial de Precios */}
      {showPriceHistoryModal && (
        <div className="modal-overlay" onClick={() => setShowPriceHistoryModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                <History size={20} className="text-primary" /> Historial de Precios: {selectedProductForHistory?.name}
              </h2>
              <button className="modal-close-btn" onClick={() => setShowPriceHistoryModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                  Cargando variaciones...
                </div>
              ) : priceHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                  No se registran cambios de precio para este producto.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>FECHA Y HORA</th>
                        <th>PRECIO ANTERIOR</th>
                        <th>PRECIO NUEVO</th>
                        <th>MODIFICADO POR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceHistory.map((h) => (
                        <tr key={h.id}>
                          <td>{formatDateTime(h.changedAt)}</td>
                          <td style={{ color: '#64748b' }}>{formatCurrency(h.oldPrice)}</td>
                          <td><strong style={{ color: 'var(--color-primary)' }}>{formatCurrency(h.newPrice)}</strong></td>
                          <td>{h.user ? `${h.user.name} ${h.user.lastName}` : 'Sistema'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPriceHistoryModal(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
