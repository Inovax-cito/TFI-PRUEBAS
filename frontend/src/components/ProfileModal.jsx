import React, { useState } from 'react';
import { X, User, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../utils/api.js';

export const ProfileModal = ({ isOpen, onClose }) => {
  const { user, updateCurrentUser } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState('data'); // 'data' | 'password'

  // Datos de perfil
  const [name, setName] = useState(user?.name || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.email || '');

  // Cambio de contraseña
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const res = await apiRequest('/auth/profile', {
        method: 'PUT',
        body: { name, lastName, email },
      });
      updateCurrentUser(res.user);
      setMessage('Datos personales actualizados correctamente.');
    } catch (err) {
      setError(err.message || 'Error al actualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setError('La nueva contraseña y su confirmación no coinciden.');
      return;
    }
    if (newPassword.length < 6) {
      setError('La nueva contraseña debe poseer al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      await apiRequest('/auth/change-password', {
        method: 'PUT',
        body: { currentPassword, newPassword },
      });
      setMessage('Contraseña modificada exitosamente.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Error al cambiar contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <User size={20} className="text-primary" /> Mi Perfil y Seguridad
          </h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', backgroundColor: '#f8fafc' }}>
          <button
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              background: activeSubTab === 'data' ? '#ffffff' : 'transparent',
              fontWeight: activeSubTab === 'data' ? 700 : 500,
              color: activeSubTab === 'data' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              borderBottom: activeSubTab === 'data' ? '2px solid var(--color-primary)' : 'none',
              cursor: 'pointer',
            }}
            onClick={() => { setActiveSubTab('data'); setMessage(null); setError(null); }}
          >
            Datos Personales
          </button>
          <button
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              background: activeSubTab === 'password' ? '#ffffff' : 'transparent',
              fontWeight: activeSubTab === 'password' ? 700 : 500,
              color: activeSubTab === 'password' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              borderBottom: activeSubTab === 'password' ? '2px solid var(--color-primary)' : 'none',
              cursor: 'pointer',
            }}
            onClick={() => { setActiveSubTab('password'); setMessage(null); setError(null); }}
          >
            Cambiar Contraseña
          </button>
        </div>

        <div className="modal-body">
          {message && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#ecfdf5', color: '#065f46', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
              <CheckCircle2 size={18} /> {message}
            </div>
          )}

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fef2f2', color: '#991b1b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
              <AlertCircle size={18} /> {error}
            </div>
          )}

          {activeSubTab === 'data' ? (
            <form onSubmit={handleUpdateProfile}>
              <div className="form-group">
                <label className="form-label">Usuario</label>
                <input className="form-input" value={user?.username || ''} disabled style={{ backgroundColor: '#f1f5f9' }} />
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>El nombre de usuario no puede modificarse.</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Nombre</label>
                  <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Apellido</label>
                  <input className="form-input" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Correo Electrónico</label>
                <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label className="form-label">Contraseña Actual</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Ingrese contraseña actual"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nueva Contraseña</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirmar Nueva Contraseña</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Repita la nueva contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
