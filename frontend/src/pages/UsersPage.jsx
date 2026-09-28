import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Edit,
  Power,
  Trash2,
  Shield,
  ShieldAlert,
  UserCheck,
  X,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { apiRequest } from '../utils/api.js';
import { formatDateTime } from '../utils/formatters.js';
import { useAuth } from '../context/AuthContext.jsx';

export const UsersPage = () => {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Modales
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    role: 'EMPLEADO',
  });
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [search, roleFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        ...(search && { search }),
        ...(roleFilter && { role: roleFilter }),
      });
      const res = await apiRequest(`/users?${query.toString()}`);
      setUsers(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      lastName: '',
      username: '',
      email: '',
      password: '',
      role: 'EMPLEADO',
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (u) => {
    setEditingUser(u);
    setFormData({
      name: u.name,
      lastName: u.lastName,
      username: u.username,
      email: u.email,
      password: '', // Dejar en blanco si no se modifica
      role: u.role,
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    try {
      if (editingUser) {
        await apiRequest(`/users/${editingUser.id}`, {
          method: 'PUT',
          body: formData,
        });
      } else {
        await apiRequest('/users', {
          method: 'POST',
          body: formData,
        });
      }
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      setFormError(err.message || 'Error al guardar usuario');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (u) => {
    if (u.id === currentUser.id) {
      alert('No puede desactivar su propio usuario conectado.');
      return;
    }

    try {
      await apiRequest(`/users/${u.id}/toggle-status`, { method: 'PATCH' });
      fetchUsers();
    } catch (err) {
      alert(err.message || 'Error al cambiar estado');
    }
  };

  const handleDeleteUser = async (u) => {
    if (u.id === currentUser.id) {
      alert('No puede eliminar su propio usuario conectado.');
      return;
    }

    const confirmDel = window.confirm(
      `¿Desea eliminar o dar de baja al usuario "${u.username}"? Si posee operaciones registradas, se realizará una baja lógica.`
    );
    if (!confirmDel) return;

    try {
      const res = await apiRequest(`/users/${u.id}`, { method: 'DELETE' });
      alert(res.message);
      fetchUsers();
    } catch (err) {
      alert(err.message || 'Error al eliminar usuario');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            <Users size={24} className="text-primary" /> Administración de Usuarios & Permisos
          </h1>
          <p className="page-subtitle">
            Control de cuentas, asignación de roles (Administrador / Empleado) y seguridad
          </p>
        </div>

        <button className="btn btn-primary" onClick={handleOpenCreate}>
          <UserPlus size={18} /> Registrar Nuevo Usuario
        </button>
      </div>

      <div className="card" style={{ marginBottom: '18px' }}>
        <div className="filters-bar" style={{ marginBottom: 0 }}>
          <div className="search-input-wrapper" style={{ maxWidth: '340px' }}>
            <Search size={16} className="search-icon-prefix" />
            <input
              type="text"
              className="form-input search-input"
              placeholder="Buscar por nombre, usuario o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              className="form-select"
              style={{ width: 'auto' }}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">Todos los Roles</option>
              <option value="ADMINISTRADOR">Administrador</option>
              <option value="EMPLEADO">Empleado</option>
            </select>
            <button className="btn btn-secondary btn-icon" onClick={fetchUsers} title="Recargar">
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
                <th>USUARIO</th>
                <th>NOMBRE Y APELLIDO</th>
                <th>CORREO ELECTRÓNICO</th>
                <th>ROL ASIGNADO</th>
                <th>OPERACIONES</th>
                <th>FECHA DE ALTA</th>
                <th>ESTADO</th>
                <th style={{ textAlign: 'right' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '30px' }}>
                    Cargando usuarios...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    No se encontraron usuarios registrados.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isCurrent = u.id === currentUser.id;

                  return (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.username}</strong>
                        {isCurrent && (
                          <span style={{ fontSize: '0.7rem', color: '#2563eb', marginLeft: '6px' }}>(Tú)</span>
                        )}
                      </td>
                      <td>{u.name} {u.lastName}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`badge ${u.role === 'ADMINISTRADOR' ? 'badge-primary' : 'badge-neutral'}`}>
                          <Shield size={12} /> {u.role}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {u._count?.sales || 0} vtas / {u._count?.purchases || 0} comp.
                        </span>
                      </td>
                      <td>{formatDateTime(u.createdAt)}</td>
                      <td>
                        <span className={`badge ${u.status ? 'badge-success' : 'badge-danger'}`}>
                          {u.status ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEdit(u)}
                            title="Editar usuario"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            className={`btn btn-sm ${u.status ? 'btn-outline-danger' : 'btn-success'}`}
                            onClick={() => handleToggleStatus(u)}
                            disabled={isCurrent}
                            title={isCurrent ? 'No puede desactivarse a sí mismo' : u.status ? 'Desactivar acceso' : 'Habilitar acceso'}
                          >
                            <Power size={14} />
                          </button>
                          <button
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => handleDeleteUser(u)}
                            disabled={isCurrent}
                            title="Eliminar usuario"
                          >
                            <Trash2 size={14} />
                          </button>
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

      {/* Modal Crear / Editar Usuario */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                <Users size={20} className="text-primary" />
                {editingUser ? `Modificar Usuario: ${editingUser.username}` : 'Registrar Nuevo Usuario'}
              </h2>
              <button className="modal-close-btn" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveUser}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                    <AlertCircle size={18} /> {formError}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Nombre *</label>
                    <input
                      className="form-input"
                      placeholder="ej: Lucas"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Apellido *</label>
                    <input
                      className="form-input"
                      placeholder="ej: González"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Nombre de Usuario (Login) *</label>
                  <input
                    className="form-input"
                    placeholder="ej: lgonzalez"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Correo Electrónico *</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="lucas@comercio.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    {editingUser ? 'Nueva Contraseña (dejar en blanco para mantener actual)' : 'Contraseña de Acceso *'}
                  </label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder={editingUser ? 'Opcional (mínimo 6 caracteres)' : 'Mínimo 6 caracteres'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingUser}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Rol y Permisos en el Sistema *</label>
                  <select
                    className="form-select"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    required
                  >
                    <option value="EMPLEADO">Empleado (Ventas, consulta de stock y caja autorizada)</option>
                    <option value="ADMINISTRADOR">Administrador (Acceso total, compras, usuarios y configuración)</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
