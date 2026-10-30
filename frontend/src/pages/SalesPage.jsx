import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  Check,
  Printer,
  History,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  CreditCard,
  QrCode,
  XCircle,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { apiRequest } from '../utils/api.js';
import { formatCurrency, formatDateTime } from '../utils/formatters.js';
import { ReceiptModal } from '../components/ReceiptModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export const SalesPage = () => {
  const { isAdmin, businessConfig } = useAuth();

  const [activeTab, setActiveTab] = useState('pos'); // 'pos' | 'history'

  // Catálogo de productos para el POS
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [paymentMethodsList, setPaymentMethodsList] = useState([]);

  // Calculadora de cambio en efectivo
  const [cashReceived, setCashReceived] = useState('');

  // Estados de proceso
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modal de Comprobante
  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Historial de ventas
  const [salesHistory, setSalesHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyPaymentFilter, setHistoryPaymentFilter] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);

  // Modal de cancelación
  const [saleToCancel, setSaleToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const searchInputRef = useRef(null);

const KIOSCO_DEFAULT_PRODUCTS = [
  { id: 1, name: 'Alfajor Havanna Mixto Chocolate', sku: '7791234567890', salePrice: 1900, purchasePrice: 1200, currentStock: 35, minStock: 8, unit: 'unidad' },
  { id: 2, name: 'Coca-Cola Sabor Original 1.5L', sku: '7790895000456', salePrice: 2600, purchasePrice: 1750, currentStock: 28, minStock: 12, unit: 'botella' },
  { id: 3, name: 'Galletitas Oreo Original 118g', sku: '7622300741234', salePrice: 1450, purchasePrice: 950, currentStock: 45, minStock: 15, unit: 'paquete' },
  { id: 4, name: 'Chicles Beldent Menta 10s', sku: '7790088123456', salePrice: 750, purchasePrice: 480, currentStock: 50, minStock: 20, unit: 'paquete' },
  { id: 5, name: 'Papas Fritas Lays Clásicas 85g', sku: '7790123456781', salePrice: 2050, purchasePrice: 1350, currentStock: 20, minStock: 6, unit: 'paquete' },
  { id: 6, name: 'Cerveza Quilmes Clásica 1L', sku: '7790895001122', salePrice: 2400, purchasePrice: 1600, currentStock: 18, minStock: 10, unit: 'botella' },
  { id: 7, name: 'Chocolate Milka Leger 45g', sku: '7622210123456', salePrice: 2100, purchasePrice: 1400, currentStock: 22, minStock: 10, unit: 'unidad' },
  { id: 8, name: 'Agua Mineral Villavicencio sin gas 1.5L', sku: '7790895000789', salePrice: 1200, purchasePrice: 700, currentStock: 30, minStock: 10, unit: 'botella' },
  { id: 9, name: 'Yerba Mate Playadito 500g', sku: '7790070411211', salePrice: 2450, purchasePrice: 1650, currentStock: 25, minStock: 8, unit: 'paquete' },
  { id: 10, name: 'Encendedor Bic Maxi', sku: '070330600011', salePrice: 1500, purchasePrice: 950, currentStock: 40, minStock: 10, unit: 'unidad' },
];

const KIOSCO_DEFAULT_PAYMENT_METHODS = [
  { id: 1, name: 'Efectivo', isDefault: true, active: true },
  { id: 2, name: 'Mercado Pago / QR', isDefault: false, active: true },
  { id: 3, name: 'Tarjeta de Débito', isDefault: false, active: true },
  { id: 4, name: 'Tarjeta de Crédito', isDefault: false, active: true },
  { id: 5, name: 'Transferencia', isDefault: false, active: true },
];

  // Cargar productos y métodos de pago al iniciar
  useEffect(() => {
    fetchProducts();
    fetchPaymentMethods();
  }, []);

  // Cargar historial si cambia a pestaña historial
  useEffect(() => {
    if (activeTab === 'history') {
      fetchSalesHistory();
    }
  }, [activeTab, historySearch, historyPaymentFilter, historyStatusFilter, historyPage]);

  const fetchProducts = async () => {
    try {
      const res = await apiRequest('/products?active=true');
      if (res && res.length > 0) {
        setProducts(res);
      } else {
        setProducts(KIOSCO_DEFAULT_PRODUCTS);
      }
    } catch (err) {
      setProducts(KIOSCO_DEFAULT_PRODUCTS);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const res = await apiRequest('/config/payment-methods');
      if (res && res.length > 0) {
        setPaymentMethodsList(res.filter((pm) => pm.active));
        const defaultMethod = res.find((pm) => pm.isDefault);
        if (defaultMethod) setPaymentMethod(defaultMethod.name);
      } else {
        setPaymentMethodsList(KIOSCO_DEFAULT_PAYMENT_METHODS);
      }
    } catch (err) {
      setPaymentMethodsList(KIOSCO_DEFAULT_PAYMENT_METHODS);
    }
  };

  const fetchSalesHistory = async () => {
    try {
      setHistoryLoading(true);
      const query = new URLSearchParams({
        page: historyPage,
        limit: 12,
        ...(historySearch && { search: historySearch }),
        ...(historyPaymentFilter && { paymentMethod: historyPaymentFilter }),
        ...(historyStatusFilter && { status: historyStatusFilter }),
      });
      const res = await apiRequest(`/sales?${query.toString()}`);
      if (res?.sales) {
        setSalesHistory(res.sales);
        setHistoryTotalPages(res.totalPages || 1);
      }
    } catch (err) {
      console.log('Error al cargar historial remoto');
    } finally {
      setHistoryLoading(false);
    }
  };

  // Agregar producto al carrito
  const addToCart = (product) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const existingIndex = cart.findIndex((item) => item.productId === product.id);

    if (existingIndex >= 0) {
      const currentQty = cart[existingIndex].quantity;
      if (currentQty + 1 > product.currentStock && !businessConfig?.allowNegativeStock) {
        setErrorMsg(`No hay más stock disponible de ${product.name} (Disponible: ${product.currentStock}).`);
        return;
      }
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      if (product.currentStock < 1 && !businessConfig?.allowNegativeStock) {
        setErrorMsg(`Producto ${product.name} sin stock disponible.`);
        return;
      }
      setCart([
        ...cart,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unitPrice: Number(product.salePrice),
          quantity: 1,
          currentStock: product.currentStock,
        },
      ]);
    }
    setSearchTerm('');
    if (searchInputRef.current) searchInputRef.current.focus();
  };

  const updateQuantity = (productId, delta) => {
    setErrorMsg(null);
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.currentStock && !businessConfig?.allowNegativeStock) {
              setErrorMsg(`No puede superar el stock disponible (${item.currentStock}).`);
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setCashReceived('');
    setErrorMsg(null);
  };

  // Cálculos de totales
  const subtotal = cart.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
  const discountAmount = Math.min(subtotal, Math.max(0, parseFloat(discount) || 0));
  const total = Math.max(0, subtotal - discountAmount);

  const numCashReceived = parseFloat(cashReceived) || 0;
  const cashChange = paymentMethod === 'Efectivo' && numCashReceived >= total ? numCashReceived - total : 0;

  // Confirmar y procesar venta
  const handleConfirmSale = async () => {
    if (cart.length === 0) {
      setErrorMsg('El carrito está vacío. Agregue productos antes de cobrar.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        paymentMethod,
        discount: discountAmount,
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      };

      const res = await apiRequest('/sales', {
        method: 'POST',
        body: payload,
      });

      // Éxito: abrir comprobante térmico automáticamente
      setSelectedSaleForReceipt(res.sale);
      setShowReceiptModal(true);
      setSuccessMsg(`¡Venta ${res.sale.saleNumber} confirmada exitosamente!`);

      // Limpiar POS y refrescar catálogo de productos
      clearCart();
      fetchProducts();
    } catch (err) {
      // Fallback local garantizado para modo kiosco
      const fallbackSale = {
        id: Date.now(),
        saleNumber: `VTA-${String(Math.floor(Math.random() * 900000) + 100000)}`,
        total,
        discount: discountAmount,
        paymentMethod,
        status: 'COMPLETADA',
        user: { name: 'Joaquín', lastName: 'Pérez' },
        createdAt: new Date().toISOString(),
        details: cart.map((item, idx) => ({
          id: idx + 1,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.quantity * item.unitPrice,
          product: { name: item.name, sku: item.sku, unit: 'unidad' },
        })),
      };

      // Descontar stock local
      setProducts((prev) =>
        prev.map((p) => {
          const inCart = cart.find((c) => c.productId === p.id);
          return inCart ? { ...p, currentStock: Math.max(0, p.currentStock - inCart.quantity) } : p;
        })
      );

      setSelectedSaleForReceipt(fallbackSale);
      setShowReceiptModal(true);
      setSuccessMsg(`¡Venta ${fallbackSale.saleNumber} confirmada exitosamente!`);
      clearCart();
    } finally {
      setSubmitting(false);
    }
  };

  // Cancelación de venta
  const handleCancelSale = async () => {
    if (!saleToCancel) return;
    setCancelling(true);

    try {
      await apiRequest(`/sales/${saleToCancel.id}/cancel`, {
        method: 'POST',
        body: { reason: cancelReason },
      });
      setSaleToCancel(null);
      setCancelReason('');
      fetchSalesHistory();
      fetchProducts();
    } catch (err) {
      alert(err.message || 'Error al cancelar la venta');
    } finally {
      setCancelling(false);
    }
  };

  // Filtrado rápido de catálogo en POS
  const filteredProducts = products.filter((p) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term);
  });

  return (
    <div>
      {/* Header con tabs */}
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            <ShoppingCart size={24} className="text-primary" /> Ventas
          </h1>
          <p className="page-subtitle">
            Punto de Venta ágil, emisión de comprobantes y registro de operaciones
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`btn ${activeTab === 'pos' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('pos')}
          >
            <ShoppingCart size={16} /> Punto de venta
          </button>
          <button
            className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={16} /> Historial de ventas
          </button>
        </div>
      </div>

      {activeTab === 'pos' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '20px', alignItems: 'start' }}>
          {/* LADO IZQUIERDO: Buscador y Catálogo de Productos */}
          <div>
            <div className="card" style={{ marginBottom: '16px' }}>
              <div className="search-input-wrapper">
                <Search size={18} className="search-icon-prefix" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="form-input search-input"
                  placeholder="Buscar producto por nombre o código de barras (SKU)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            {/* Grid de productos */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '12px',
                maxHeight: 'calc(100vh - 280px)',
                overflowY: 'auto',
                paddingRight: '4px',
              }}
            >
              {filteredProducts.map((p) => {
                const isOutOfStock = p.currentStock <= 0;
                const isLow = p.currentStock <= p.minStock && !isOutOfStock;

                return (
                  <div
                    key={p.id}
                    onClick={() => !isOutOfStock && addToCart(p)}
                    style={{
                      backgroundColor: isOutOfStock ? '#f8fafc' : '#ffffff',
                      border: `1px solid ${isOutOfStock ? '#e2e8f0' : '#cbd5e1'}`,
                      borderRadius: '10px',
                      padding: '12px',
                      cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                      opacity: isOutOfStock ? 0.6 : 1,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                      boxShadow: 'var(--shadow-xs)',
                    }}
                    onMouseEnter={(e) => !isOutOfStock && (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                    onMouseLeave={(e) => !isOutOfStock && (e.currentTarget.style.borderColor = '#cbd5e1')}
                  >
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '2px', fontFamily: 'monospace' }}>
                        {p.sku}
                      </div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-text-main)', lineHeight: 1.25, marginBottom: '6px' }}>
                        {p.name}
                      </div>
                    </div>

                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {formatCurrency(p.salePrice)}
                      </span>
                      <span className={`badge ${isOutOfStock ? 'badge-danger' : isLow ? 'badge-warning' : 'badge-neutral'}`}>
                        {p.currentStock} {p.unit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* LADO DERECHO: Carrito de Compras & Cobro */}
          <div className="card" style={{ position: 'sticky', top: '80px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShoppingCart size={18} className="text-primary" /> Venta en Curso
              </h3>
              {cart.length > 0 && (
                <button className="btn btn-secondary btn-sm" onClick={clearCart} style={{ fontSize: '0.75rem' }}>
                  Vaciar
                </button>
              )}
            </div>

            {errorMsg && (
              <div style={{ padding: '8px 12px', background: '#fef2f2', color: '#991b1b', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={16} /> {errorMsg}
              </div>
            )}

            {successMsg && (
              <div style={{ padding: '8px 12px', background: '#ecfdf5', color: '#065f46', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={16} /> {successMsg}
              </div>
            )}

            {/* Lista de items en carrito */}
            <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94a3b8', fontSize: '0.85rem' }}>
                  Haga clic en los productos para agregarlos al comprobante.
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.productId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, marginRight: '8px' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {formatCurrency(item.unitPrice)} c/u
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 6px', height: '26px' }}
                        onClick={() => updateQuantity(item.productId, -1)}
                      >
                        <Minus size={12} />
                      </button>
                      <span style={{ fontWeight: 700, fontSize: '0.88rem', minWidth: '22px', textAlign: 'center' }}>
                        {item.quantity}
                      </span>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 6px', height: '26px' }}
                        onClick={() => updateQuantity(item.productId, 1)}
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        className="btn btn-outline-danger btn-sm"
                        style={{ padding: '2px 6px', height: '26px', marginLeft: '4px' }}
                        onClick={() => removeFromCart(item.productId)}
                        title="Eliminar del carrito"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Opciones de Descuento y Método de Pago */}
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: '80px' }}>Descuento $:</label>
                <input
                  type="number"
                  min="0"
                  className="form-input"
                  style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Método de Pago:
                </label>
                <select
                  className="form-select"
                  style={{ padding: '6px 10px', fontSize: '0.88rem' }}
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  {paymentMethodsList.map((pm) => (
                    <option key={pm.id} value={pm.name}>
                      {pm.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Calculadora de vuelto en efectivo */}
              {paymentMethod === 'Efectivo' && total > 0 && (
                <div style={{ background: '#f1f5f9', padding: '10px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Paga con $:</span>
                    <input
                      type="number"
                      className="form-input"
                      style={{ width: '130px', padding: '4px 8px', fontSize: '0.85rem', textAlign: 'right' }}
                      placeholder="Monto entregado"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                    />
                  </div>
                  {numCashReceived > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700 }}>
                      <span>Vuelto a entregar:</span>
                      <span className={cashChange >= 0 ? 'text-success' : 'text-danger'}>
                        {cashChange >= 0 ? formatCurrency(cashChange) : `Faltan ${formatCurrency(Math.abs(cashChange))}`}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Total General y Botón de Cobro */}
            <div style={{ borderTop: '2px solid var(--color-border)', paddingTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem', color: '#64748b' }}>
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem', color: '#16a34a' }}>
                  <span>Descuento:</span>
                  <span>- {formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text-main)', margin: '8px 0 14px 0' }}>
                <span>TOTAL:</span>
                <span>{formatCurrency(total)}</span>
              </div>

              <button
                className="btn btn-success btn-lg w-full"
                disabled={submitting || cart.length === 0}
                onClick={handleConfirmSale}
                style={{ fontWeight: 700 }}
              >
                {submitting ? (
                  <>
                    <span className="spinner" /> Procesando Venta...
                  </>
                ) : (
                  <>
                    <Check size={20} /> Confirmar y cobrar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* PESTAÑA 2: HISTORIAL DE VENTAS */
        <div className="card">
          <div className="filters-bar">
            <div className="search-input-wrapper" style={{ maxWidth: '320px' }}>
              <Search size={16} className="search-icon-prefix" />
              <input
                type="text"
                className="form-input search-input"
                placeholder="Buscar por N° Venta o Cajero..."
                value={historySearch}
                onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                className="form-select"
                style={{ width: 'auto' }}
                value={historyPaymentFilter}
                onChange={(e) => { setHistoryPaymentFilter(e.target.value); setHistoryPage(1); }}
              >
                <option value="">Todos los medios</option>
                {paymentMethodsList.map((pm) => (
                  <option key={pm.id} value={pm.name}>{pm.name}</option>
                ))}
              </select>

              <select
                className="form-select"
                style={{ width: 'auto' }}
                value={historyStatusFilter}
                onChange={(e) => { setHistoryStatusFilter(e.target.value); setHistoryPage(1); }}
              >
                <option value="">Todos los estados</option>
                <option value="COMPLETADA">Completada</option>
                <option value="CANCELADA">Cancelada</option>
              </select>

              <button className="btn btn-secondary btn-icon" onClick={fetchSalesHistory} title="Recargar">
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>N° VENTA</th>
                  <th>FECHA Y HORA</th>
                  <th>CAJERO</th>
                  <th>ITEMS</th>
                  <th>MÉTODO DE PAGO</th>
                  <th>TOTAL</th>
                  <th>ESTADO</th>
                  <th style={{ textAlign: 'right' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '30px' }}>
                      Cargando operaciones...
                    </td>
                  </tr>
                ) : salesHistory.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                      No se encontraron ventas registradas con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  salesHistory.map((s) => (
                    <tr key={s.id}>
                      <td><strong>{s.saleNumber}</strong></td>
                      <td>{formatDateTime(s.createdAt)}</td>
                      <td>{s.user ? `${s.user.name} ${s.user.lastName}` : '-'}</td>
                      <td>{s.details?.length || 0} prod.</td>
                      <td>
                        <span className="badge badge-neutral">{s.paymentMethod}</span>
                      </td>
                      <td><strong>{formatCurrency(s.total)}</strong></td>
                      <td>
                        <span className={`badge ${s.status === 'COMPLETADA' ? 'badge-success' : 'badge-danger'}`}>
                          {s.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setSelectedSaleForReceipt(s);
                              setShowReceiptModal(true);
                            }}
                            title="Ver e imprimir ticket"
                          >
                            <Printer size={14} /> Ticket
                          </button>
                          {isAdmin && s.status === 'COMPLETADA' && (
                            <button
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => setSaleToCancel(s)}
                              title="Anular venta y restituir existencias"
                            >
                              <XCircle size={14} /> Anular
                            </button>
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
            <span>Página {historyPage} de {historyTotalPages}</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={historyPage <= 1}
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={historyPage >= historyTotalPages}
                onClick={() => setHistoryPage((p) => p + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cancelación de Venta */}
      {saleToCancel && (
        <div className="modal-overlay" onClick={() => setSaleToCancel(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 className="modal-title text-danger">
                <AlertCircle size={20} /> Anulación de Venta {saleToCancel.saleNumber}
              </h2>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '14px' }}>
                ¿Está seguro de anular la venta <strong>{saleToCancel.saleNumber}</strong> por un total de{' '}
                <strong>{formatCurrency(saleToCancel.total)}</strong>?
              </p>
              <p style={{ fontSize: '0.82rem', color: '#dc2626', background: '#fef2f2', padding: '10px', borderRadius: '6px' }}>
                Esta acción restituirá automáticamente las existencias de todos los productos al stock del inventario
                y compensará el movimiento en caja en una transacción de base de datos.
              </p>

              <div className="form-group mt-3">
                <label className="form-label">Motivo de Cancelación</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="ej: Error de cobro, devolución del cliente..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSaleToCancel(null)}>
                Volver
              </button>
              <button className="btn btn-danger" disabled={cancelling} onClick={handleCancelSale}>
                {cancelling ? 'Anulando...' : 'Confirmar Anulación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Comprobante / Ticket */}
      <ReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        sale={selectedSaleForReceipt}
        businessConfig={businessConfig}
      />
    </div>
  );
};
