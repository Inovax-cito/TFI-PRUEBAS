import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  Eye,
  AlertCircle,
  Calendar,
  X,
  Package,
  Building2,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { apiRequest } from '../utils/api.js';
import { formatCurrency, formatDateTime } from '../utils/formatters.js';

export const PurchasesPage = () => {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal Nueva Compra
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [purchaseStatus, setPurchaseStatus] = useState('PENDIENTE'); // PENDIENTE o RECIBIDA
  const [notes, setNotes] = useState('');
  const [payFromCash, setPayFromCash] = useState(false);
  const [items, setItems] = useState([]);
  const [createError, setCreateError] = useState(null);
  const [creating, setCreating] = useState(false);

  // Detalle de compra
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Recepción de compra pendiente
  const [receivingId, setReceivingId] = useState(null);

  useEffect(() => {
    fetchPurchases();
    fetchSuppliers();
    fetchProducts();
  }, [search, supplierFilter, statusFilter, page]);

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        page,
        limit: 12,
        ...(search && { search }),
        ...(supplierFilter && { supplierId: supplierFilter }),
        ...(statusFilter && { status: statusFilter }),
      });
      const res = await apiRequest(`/purchases?${query.toString()}`);
      setPurchases(res.purchases || []);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await apiRequest('/suppliers?active=true');
      setSuppliers(res || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await apiRequest('/products?active=true');
      setProducts(res || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenCreate = () => {
    setSelectedSupplierId(suppliers[0]?.id || '');
    setPurchaseStatus('PENDIENTE');
    setNotes('');
    setPayFromCash(false);
    setItems([]);
    setCreateError(null);
    setShowCreateModal(true);
  };

  const handleAddItemToPurchase = (productId) => {
    if (!productId) return;
    const prod = products.find((p) => p.id === parseInt(productId, 10));
    if (!prod) return;

    if (items.some((i) => i.productId === prod.id)) {
      return; // Ya está agregado
    }

    setItems([
      ...items,
      {
        productId: prod.id,
        name: prod.name,
        sku: prod.sku,
        unitCost: Number(prod.purchasePrice),
        quantity: 1,
      },
    ]);
  };

  const handleUpdateItem = (productId, field, value) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.productId === productId) {
          return { ...i, [field]: value };
        }
        return i;
      })
    );
  };

  const handleRemoveItem = (productId) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const calculatePurchaseTotal = () => {
    return items.reduce((acc, i) => acc + (parseFloat(i.unitCost) || 0) * (parseInt(i.quantity, 10) || 0), 0);
  };

  const handleCreatePurchase = async (e) => {
    e.preventDefault();
    if (items.length === 0) {
      setCreateError('Debe agregar al menos un producto a la compra.');
      return;
    }

    setCreateError(null);
    setCreating(true);

    try {
      await apiRequest('/purchases', {
        method: 'POST',
        body: {
          supplierId: parseInt(selectedSupplierId, 10),
          status: purchaseStatus,
          notes,
          payFromCash,
          items: items.map((i) => ({
            productId: i.productId,
            quantity: parseInt(i.quantity, 10),
            unitCost: parseFloat(i.unitCost),
          })),
        },
      });

      setShowCreateModal(false);
      fetchPurchases();
    } catch (err) {
      setCreateError(err.message || 'Error al registrar orden de compra');
    } finally {
      setCreating(false);
    }
  };

  const handleReceivePurchase = async (purchaseId) => {
    const confirmRec = window.confirm(
      '¿Desea marcar esta compra como RECIBIDA? El stock de los productos se actualizará automáticamente y se registrará el ingreso en el inventario.'
    );
    if (!confirmRec) return;

    setReceivingId(purchaseId);
    try {
      await apiRequest(`/purchases/${purchaseId}/receive`, {
        method: 'POST',
        body: { payFromCash: false },
      });
      fetchPurchases();
    } catch (err) {
      alert(err.message || 'Error al recepcionar la compra');
    } finally {
      setReceivingId(null);
    }
  };

  const handleCancelPurchase = async (purchaseId) => {
    const confirmCancel = window.confirm('¿Está seguro de cancelar esta orden de compra?');
    if (!confirmCancel) return;

    try {
      await apiRequest(`/purchases/${purchaseId}/cancel`, { method: 'POST' });
      fetchPurchases();
    } catch (err) {
      alert(err.message || 'Error al cancelar la compra');
    }
  };

  const handleViewDetail = async (p) => {
    try {
      const res = await apiRequest(`/purchases/${p.id}`);
      setSelectedPurchase(res);
      setShowDetailModal(true);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            <Truck size={24} className="text-primary" /> Compras a proveedores
          </h1>
          <p className="page-subtitle">
            Órdenes de adquisición de mercadería, recepción de stock y control de costos
          </p>
        </div>

        <button className="btn btn-primary" onClick={handleOpenCreate}>
          <Plus size={18} /> Registrar Nueva Compra
        </button>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: '18px' }}>
        <div className="filters-bar" style={{ marginBottom: 0 }}>
          <div className="search-input-wrapper" style={{ maxWidth: '320px' }}>
            <Search size={16} className="search-icon-prefix" />
            <input
              type="text"
              className="form-input search-input"
              placeholder="Buscar por N° Compra o Proveedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              className="form-select"
              style={{ width: 'auto' }}
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
            >
              <option value="">Todos los Proveedores</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <select
              className="form-select"
              style={{ width: 'auto' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Todos los estados</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="RECIBIDA">Recibida</option>
              <option value="CANCELADA">Cancelada</option>
            </select>

            <button className="btn btn-secondary btn-icon" onClick={fetchPurchases} title="Recargar">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de Compras */}
      <div className="card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>N° COMPRA</th>
                <th>PROVEEDOR</th>
                <th>FECHA</th>
                <th>TOTAL</th>
                <th>RESPONSABLE</th>
                <th>ESTADO</th>
                <th style={{ textAlign: 'right' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px' }}>
                    Cargando compras...
                  </td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    No se encontraron compras registradas.
                  </td>
                </tr>
              ) : (
                purchases.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.purchaseNumber}</strong></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.supplier?.name}</div>
                      {p.supplier?.cuit && (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>CUIT: {p.supplier.cuit}</div>
                      )}
                    </td>
                    <td>{formatDateTime(p.createdAt)}</td>
                    <td><strong>{formatCurrency(p.total)}</strong></td>
                    <td>{p.user ? `${p.user.name} ${p.user.lastName}` : '-'}</td>
                    <td>
                      <span className={`badge ${p.status === 'RECIBIDA' ? 'badge-success' : p.status === 'PENDIENTE' ? 'badge-warning' : 'badge-danger'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleViewDetail(p)}
                          title="Ver detalle de la compra"
                        >
                          <Eye size={14} /> Detalle
                        </button>

                        {p.status === 'PENDIENTE' && (
                          <>
                            <button
                              className="btn btn-success btn-sm"
                              disabled={receivingId === p.id}
                              onClick={() => handleReceivePurchase(p.id)}
                              title="Marcar como recibida y actualizar existencias"
                            >
                              <CheckCircle size={14} /> {receivingId === p.id ? 'Recibiendo...' : 'Recibir'}
                            </button>
                            <button
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => handleCancelPurchase(p.id)}
                              title="Cancelar orden"
                            >
                              <XCircle size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="pagination-bar">
          <span>Página {page} de {totalPages}</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {/* Modal Registrar Compra */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-dialog modal-xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                <Truck size={20} className="text-primary" /> Registrar Orden de Compra a Proveedor
              </h2>
              <button className="modal-close-btn" onClick={() => setShowCreateModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreatePurchase}>
              <div className="modal-body">
                {createError && (
                  <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                    <AlertCircle size={18} /> {createError}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Proveedor *</label>
                    <select
                      className="form-select"
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
                      required
                    >
                      <option value="">Seleccione proveedor</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.cuit || 'S/CUIT'})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Estado Inicial *</label>
                    <select
                      className="form-select"
                      value={purchaseStatus}
                      onChange={(e) => setPurchaseStatus(e.target.value)}
                    >
                      <option value="PENDIENTE">Pendiente (No incrementa stock hasta recibir)</option>
                      <option value="RECIBIDA">Recibida Inmediatamente (Suma stock ahora)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Observaciones</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="ej: Factura A-0001, remito..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>

                {/* Buscador de producto para agregar */}
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                  <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>
                    Agregar Productos a la Orden
                  </label>
                  <select
                    className="form-select"
                    onChange={(e) => {
                      handleAddItemToPurchase(e.target.value);
                      e.target.value = '';
                    }}
                  >
                    <option value="">Buscar y seleccionar producto para agregar...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — [SKU: {p.sku}] (Costo actual: {formatCurrency(p.purchasePrice)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tabla de items agregados */}
                <div className="table-responsive" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>PRODUCTO</th>
                        <th style={{ width: '130px' }}>CANTIDAD</th>
                        <th style={{ width: '160px' }}>COSTO UNITARIO $</th>
                        <th>SUBTOTAL</th>
                        <th style={{ width: '50px', textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                            Agregue productos del catálogo arriba para confeccionar la compra.
                          </td>
                        </tr>
                      ) : (
                        items.map((item) => {
                          const itemSubtotal = (parseFloat(item.unitCost) || 0) * (parseInt(item.quantity, 10) || 0);
                          return (
                            <tr key={item.productId}>
                              <td>
                                <strong>{item.name}</strong>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>SKU: {item.sku}</div>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="1"
                                  className="form-input"
                                  style={{ padding: '6px' }}
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateItem(item.productId, 'quantity', e.target.value)}
                                  required
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="form-input"
                                  style={{ padding: '6px' }}
                                  value={item.unitCost}
                                  onChange={(e) => handleUpdateItem(item.productId, 'unitCost', e.target.value)}
                                  required
                                />
                              </td>
                              <td><strong>{formatCurrency(itemSubtotal)}</strong></td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-outline-danger btn-sm"
                                  onClick={() => handleRemoveItem(item.productId)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Total */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>
                    TOTAL ORDEN: <span className="text-primary">{formatCurrency(calculatePurchaseTotal())}</span>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Guardando...' : 'Confirmar Orden de Compra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalle de Compra */}
      {showDetailModal && selectedPurchase && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                <Truck size={20} className="text-primary" /> Detalle de Compra {selectedPurchase.purchaseNumber}
              </h2>
              <button className="modal-close-btn" onClick={() => setShowDetailModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f8fafc', padding: '14px', borderRadius: '8px', marginBottom: '16px' }}>
                <div>
                  <div><strong>Proveedor:</strong> {selectedPurchase.supplier?.name}</div>
                  <div><strong>CUIT:</strong> {selectedPurchase.supplier?.cuit || '-'}</div>
                  <div><strong>Teléfono:</strong> {selectedPurchase.supplier?.phone || '-'}</div>
                </div>
                <div>
                  <div><strong>Fecha de registro:</strong> {formatDateTime(selectedPurchase.createdAt)}</div>
                  <div><strong>Registrado por:</strong> {selectedPurchase.user ? `${selectedPurchase.user.name} ${selectedPurchase.user.lastName}` : '-'}</div>
                  <div>
                    <strong>Estado:</strong>{' '}
                    <span className={`badge ${selectedPurchase.status === 'RECIBIDA' ? 'badge-success' : 'badge-warning'}`}>
                      {selectedPurchase.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>PRODUCTO</th>
                      <th>CANTIDAD</th>
                      <th>COSTO UNITARIO</th>
                      <th>SUBTOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPurchase.details?.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <strong>{d.product?.name}</strong>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>SKU: {d.product?.sku}</div>
                        </td>
                        <td>{d.quantity} {d.product?.unit}</td>
                        <td>{formatCurrency(d.unitCost)}</td>
                        <td><strong>{formatCurrency(d.subtotal)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ textAlign: 'right', marginTop: '16px', fontSize: '1.25rem', fontWeight: 800 }}>
                TOTAL: {formatCurrency(selectedPurchase.total)}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
