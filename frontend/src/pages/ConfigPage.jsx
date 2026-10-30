import React, { useState, useEffect } from 'react';
import {
  Settings,
  Store,
  CreditCard,
  Tags,
  CheckCircle2,
  AlertCircle,
  Plus,
  Power,
  Edit,
  Save,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { apiRequest } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export const ConfigPage = () => {
  const { isAdmin, businessConfig, updateBusinessConfig } = useAuth();

  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'payments' | 'categories'

  // Datos generales del comercio
  const [formData, setFormData] = useState({
    businessName: '',
    cuit: '',
    address: '',
    phone: '',
    email: '',
    currencyCode: 'ARS',
    currencySymbol: '$',
    receiptFooter: '',
    allowNegativeStock: false,
  });

  const [savingGeneral, setSavingGeneral] = useState(false);
  const [generalMessage, setGeneralMessage] = useState(null);
  const [generalError, setGeneralError] = useState(null);

  // Métodos de pago
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [newPaymentName, setNewPaymentName] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  // Categorías
  const [categories, setCategories] = useState([]);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [savingCat, setSavingCat] = useState(false);

  useEffect(() => {
    fetchConfig();
    fetchPaymentMethods();
    fetchCategories();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await apiRequest('/config');
      if (res) {
        setFormData({
          businessName: res.businessName || '',
          cuit: res.cuit || '',
          address: res.address || '',
          phone: res.phone || '',
          email: res.email || '',
          currencyCode: res.currencyCode || 'ARS',
          currencySymbol: res.currencySymbol || '$',
          receiptFooter: res.receiptFooter || '',
          allowNegativeStock: Boolean(res.allowNegativeStock),
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const res = await apiRequest('/config/payment-methods');
      setPaymentMethods(res || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await apiRequest('/categories');
      setCategories(res || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveGeneral = async (e) => {
    e.preventDefault();
    setSavingGeneral(true);
    setGeneralMessage(null);
    setGeneralError(null);

    try {
      const res = await apiRequest('/config', {
        method: 'PUT',
        body: formData,
      });
      updateBusinessConfig(res.config);
      setGeneralMessage('Configuración comercial actualizada correctamente.');
    } catch (err) {
      setGeneralError(err.message || 'Error al guardar configuración');
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleCreatePaymentMethod = async (e) => {
    e.preventDefault();
    if (!newPaymentName.trim()) return;
    setSavingPayment(true);

    try {
      await apiRequest('/config/payment-methods', {
        method: 'POST',
        body: { name: newPaymentName.trim() },
      });
      setNewPaymentName('');
      fetchPaymentMethods();
    } catch (err) {
      alert(err.message || 'Error al crear método de pago');
    } finally {
      setSavingPayment(false);
    }
  };

  const handleTogglePaymentMethod = async (pm) => {
    try {
      await apiRequest(`/config/payment-methods/${pm.id}/toggle`, { method: 'PATCH' });
      fetchPaymentMethods();
    } catch (err) {
      alert(err.message || 'Error al actualizar método de pago');
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setSavingCat(true);

    try {
      await apiRequest('/categories', {
        method: 'POST',
        body: { name: newCatName.trim(), description: newCatDesc.trim() },
      });
      setNewCatName('');
      setNewCatDesc('');
      fetchCategories();
    } catch (err) {
      alert(err.message || 'Error al crear categoría');
    } finally {
      setSavingCat(false);
    }
  };

  const handleDeleteCategory = async (cat) => {
    const confirmDel = window.confirm(`¿Desea desactivar o eliminar la categoría "${cat.name}"?`);
    if (!confirmDel) return;

    try {
      const res = await apiRequest(`/categories/${cat.id}`, { method: 'DELETE' });
      alert(res.message);
      fetchCategories();
    } catch (err) {
      alert(err.message || 'Error al eliminar categoría');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            <Settings size={24} className="text-primary" /> Configuración
          </h1>
          <p className="page-subtitle">
            Parámetros del comercio, métodos de pago, categorías de productos y preferencias
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`btn ${activeTab === 'general' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('general')}
          >
            <Store size={16} /> Datos del Comercio
          </button>
          <button
            className={`btn ${activeTab === 'payments' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('payments')}
          >
            <CreditCard size={16} /> Métodos de Pago
          </button>
          <button
            className={`btn ${activeTab === 'categories' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('categories')}
          >
            <Tags size={16} /> Categorías
          </button>
        </div>
      </div>

      {/* PESTAÑA 1: DATOS DEL COMERCIO */}
      {activeTab === 'general' && (
        <div className="card" style={{ maxWidth: '800px' }}>
          <div className="card-header">
            <h3 className="card-title">
              <Store size={18} className="text-primary" /> Datos del negocio
            </h3>
          </div>

          {generalMessage && (
            <div style={{ padding: '10px 14px', background: '#ecfdf5', color: '#065f46', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
              <CheckCircle2 size={18} /> {generalMessage}
            </div>
          )}

          {generalError && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
              <AlertCircle size={18} /> {generalError}
            </div>
          )}

          <form onSubmit={handleSaveGeneral}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Nombre del Comercio / Emprendimiento *</label>
                <input
                  className="form-input"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  disabled={!isAdmin}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">CUIT / Identificación Tributaria</label>
                <input
                  className="form-input"
                  placeholder="20-00000000-0"
                  value={formData.cuit}
                  onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                  disabled={!isAdmin}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Dirección del Local</label>
                <input
                  className="form-input"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  disabled={!isAdmin}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Teléfono de Contacto</label>
                <input
                  className="form-input"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={!isAdmin}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Correo Electrónico Comercial</label>
              <input
                type="email"
                className="form-input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!isAdmin}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Moneda Predeterminada</label>
                <input
                  className="form-input"
                  value="Peso Argentino (ARS - $)"
                  disabled
                  style={{ background: '#f1f5f9' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Control Estricto de Stock</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '42px' }}>
                  <input
                    type="checkbox"
                    id="negativeStock"
                    checked={formData.allowNegativeStock}
                    onChange={(e) => setFormData({ ...formData, allowNegativeStock: e.target.checked })}
                    disabled={!isAdmin}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="negativeStock" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                    Permitir ventas con stock negativo (no recomendado)
                  </label>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Pie de Página en Comprobantes Internos</label>
              <textarea
                className="form-textarea"
                rows={2}
                value={formData.receiptFooter}
                onChange={(e) => setFormData({ ...formData, receiptFooter: e.target.value })}
                disabled={!isAdmin}
              />
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Texto que aparecerá al pie de cada ticket impreso a los clientes.
              </span>
            </div>

            {isAdmin && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="submit" className="btn btn-primary btn-lg" disabled={savingGeneral}>
                  <Save size={18} /> {savingGeneral ? 'Guardando...' : 'Guardar Cambios de Configuración'}
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* PESTAÑA 2: MÉTODOS DE PAGO */}
      {activeTab === 'payments' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <CreditCard size={18} className="text-primary" /> Medios de cobro habilitados
              </h3>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>MÉTODO DE PAGO</th>
                    <th>PREDETERMINADO</th>
                    <th>ESTADO</th>
                    {isAdmin && <th style={{ textAlign: 'right' }}>ACCIÓN</th>}
                  </tr>
                </thead>
                <tbody>
                  {paymentMethods.map((pm) => (
                    <tr key={pm.id}>
                      <td><strong>{pm.name}</strong></td>
                      <td>
                        {pm.isDefault ? (
                          <span className="badge badge-primary">Predeterminado</span>
                        ) : '-'}
                      </td>
                      <td>
                        <span className={`badge ${pm.active ? 'badge-success' : 'badge-danger'}`}>
                          {pm.active ? 'Habilitado' : 'Deshabilitado'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className={`btn btn-sm ${pm.active ? 'btn-outline-danger' : 'btn-success'}`}
                            onClick={() => handleTogglePaymentMethod(pm)}
                            title={pm.active ? 'Desactivar medio de pago' : 'Activar medio de pago'}
                          >
                            <Power size={14} /> {pm.active ? 'Desactivar' : 'Habilitar'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Formulario Agregar Método de Pago */}
          {isAdmin && (
            <div className="card" style={{ height: 'fit-content' }}>
              <div className="card-header">
                <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Agregar Medio de Cobro</h4>
              </div>
              <form onSubmit={handleCreatePaymentMethod}>
                <div className="form-group">
                  <label className="form-label">Nombre del Medio de Pago *</label>
                  <input
                    className="form-input"
                    placeholder="ej: Cuenta DNI / MODO"
                    value={newPaymentName}
                    onChange={(e) => setNewPaymentName(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary w-full" disabled={savingPayment}>
                  <Plus size={16} /> {savingPayment ? 'Agregando...' : 'Agregar Método'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 3: CATEGORÍAS */}
      {activeTab === 'categories' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Tags size={18} className="text-primary" /> Categorías de productos
              </h3>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>CATEGORÍA</th>
                    <th>DESCRIPCIÓN</th>
                    <th>PRODUCTOS ASOCIADOS</th>
                    <th>ESTADO</th>
                    {isAdmin && <th style={{ textAlign: 'right' }}>ACCIONES</th>}
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.name}</strong></td>
                      <td>{c.description || '-'}</td>
                      <td>
                        <span className="badge badge-neutral">
                          {c._count?.products || 0} artículos
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${c.active ? 'badge-success' : 'badge-danger'}`}>
                          {c.active ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => handleDeleteCategory(c)}
                            title="Desactivar o eliminar categoría"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Formulario Agregar Categoría */}
          {isAdmin && (
            <div className="card" style={{ height: 'fit-content' }}>
              <div className="card-header">
                <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Nueva Categoría</h4>
              </div>
              <form onSubmit={handleCreateCategory}>
                <div className="form-group">
                  <label className="form-label">Nombre de Categoría *</label>
                  <input
                    className="form-input"
                    placeholder="ej: Verdulería / Congelados"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Descripción Opcional</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="Detalle o familia de artículos..."
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary w-full" disabled={savingCat}>
                  <Plus size={16} /> {savingCat ? 'Creando...' : 'Crear Categoría'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
