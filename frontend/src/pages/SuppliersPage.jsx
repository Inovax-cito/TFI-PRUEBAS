import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  Edit,
  Power,
  Phone,
  Mail,
  MapPin,
  X,
  AlertCircle,
  Truck,
  RefreshCw,
} from 'lucide-react';
import { apiRequest } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export const SuppliersPage = () => {
  const { isAdmin } = useAuth();

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal Crear / Editar
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    cuit: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSuppliers();
  }, [search, statusFilter]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        ...(search && { search }),
        ...(statusFilter !== '' && { active: statusFilter }),
      });
      const res = await apiRequest(`/suppliers?${query.toString()}`);
      setSuppliers(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingSupplier(null);
    setFormData({
      name: '',
      cuit: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (s) => {
    setEditingSupplier(s);
    setFormData({
      name: s.name,
      cuit: s.cuit || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      notes: s.notes || '',
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSaveSupplier = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    try {
      if (editingSupplier) {
        await apiRequest(`/suppliers/${editingSupplier.id}`, {
          method: 'PUT',
          body: formData,
        });
      } else {
        await apiRequest('/suppliers', {
          method: 'POST',
          body: formData,
        });
      }
      setShowModal(false);
      fetchSuppliers();
    } catch (err) {
      setFormError(err.message || 'Error al guardar proveedor');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (s) => {
    try {
      await apiRequest(`/suppliers/${s.id}/toggle-status`, { method: 'PATCH' });
      fetchSuppliers();
    } catch (err) {
      alert(err.message || 'Error al cambiar estado');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            <Building2 size={24} className="text-primary" /> Directorio de Proveedores
          </h1>
          <p className="page-subtitle">
            Administración de empresas distribuidoras, contactos y condiciones de compra
          </p>
        </div>

        {isAdmin && (
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={18} /> Registrar Nuevo Proveedor
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: '18px' }}>
        <div className="filters-bar" style={{ marginBottom: 0 }}>
          <div className="search-input-wrapper" style={{ maxWidth: '340px' }}>
            <Search size={16} className="search-icon-prefix" />
            <input
              type="text"
              className="form-input search-input"
              placeholder="Buscar por razón social, CUIT o teléfono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              className="form-select"
              style={{ width: 'auto' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Todos los estados</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
            <button className="btn btn-secondary btn-icon" onClick={fetchSuppliers} title="Recargar">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>RAZÓN SOCIAL / NOMBRE</th>
                <th>CUIT</th>
                <th>CONTACTO</th>
                <th>DIRECCIÓN</th>
                <th>COMPRAS</th>
                <th>ESTADO</th>
                {isAdmin && <th style={{ textAlign: 'right' }}>ACCIONES</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px' }}>
                    Cargando proveedores...
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    No se encontraron proveedores registrados.
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{s.name}</div>
                      {s.notes && (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{s.notes}</div>
                      )}
                    </td>
                    <td>{s.cuit || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.8rem' }}>
                        {s.phone && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Phone size={12} className="text-muted" /> {s.phone}
                          </span>
                        )}
                        {s.email && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Mail size={12} className="text-muted" /> {s.email}
                          </span>
                        )}
                        {!s.phone && !s.email && '-'}
                      </div>
                    </td>
                    <td>
                      {s.address ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                          <MapPin size={12} className="text-muted" /> {s.address}
                        </span>
                      ) : '-'}
                    </td>
                    <td>
                      <span className="badge badge-neutral">
                        <Truck size={12} /> {s._count?.purchases || 0} órdenes
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${s.active ? 'badge-success' : 'badge-danger'}`}>
                        {s.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEdit(s)}
                            title="Editar proveedor"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            className={`btn btn-sm ${s.active ? 'btn-outline-danger' : 'btn-success'}`}
                            onClick={() => handleToggleStatus(s)}
                            title={s.active ? 'Desactivar proveedor' : 'Reactivar proveedor'}
                          >
                            <Power size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear / Editar Proveedor */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                <Building2 size={20} className="text-primary" />
                {editingSupplier ? `Modificar Proveedor: ${editingSupplier.name}` : 'Registrar Nuevo Proveedor'}
              </h2>
              <button className="modal-close-btn" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                    <AlertCircle size={18} /> {formError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Razón Social o Nombre Comercial *</label>
                  <input
                    className="form-input"
                    placeholder="ej: Molinos Río de la Plata S.A."
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">CUIT</label>
                    <input
                      className="form-input"
                      placeholder="30-00000000-0"
                      value={formData.cuit}
                      onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Teléfono</label>
                    <input
                      className="form-input"
                      placeholder="ej: 011-4567-8900"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Correo Electrónico</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="pedidos@proveedor.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Dirección / Localidad</label>
                  <input
                    className="form-input"
                    placeholder="ej: Av. Libertador 2200, Vicente López"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Observaciones (días de entrega, plazos de pago...)</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : editingSupplier ? 'Actualizar Proveedor' : 'Guardar Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
