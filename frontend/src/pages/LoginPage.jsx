import React, { useState } from 'react';
import { Store, Eye, EyeOff, Lock, User, AlertCircle, ArrowRight, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../utils/api.js';
import { GoogleSignInButton } from '../components/GoogleSignInButton.jsx';
import { RoleChoice } from '../components/portal/RoleChoice.jsx';
import './PortalExtras.css';

export const LoginPage = () => {
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [registering, setRegistering] = useState(false);
  const [registration, setRegistration] = useState({ name: '', lastName: '', username: '', email: '', role: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (registering && !registration.role) { setError('Elegí si sos emprendedor/a o si administrás un espacio.'); return; }
    setLoading(true);

    try {
      const data = await apiRequest(registering ? '/auth/register' : '/auth/login', {
        method: 'POST',
        body: registering ? { ...registration, password } : { identifier, password },
      });
      login(data);
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión. Compruebe sus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  const changeMode = () => { setRegistering(!registering); setError(null); setPassword(''); };

  return (
    <div
      className="emprende-login"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f7f9',
        padding: '20px',
        backgroundImage: 'none',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 12px 38px rgba(19, 35, 68, 0.1)',
          border: '1px solid #e0e6ec',
          overflow: 'hidden',
        }}
      >
        {/* Encabezado */}
        <div
          style={{
            padding: '32px 32px 24px 32px',
            textAlign: 'center',
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #07999b 0%, #087980 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              boxShadow: '0 4px 12px rgba(0, 140, 145, 0.2)',
            }}
          >
            <Store size={28} />
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text-main)', margin: '0 0 6px 0' }}>
            Emprende
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
            Ferias, eventos y espacios verificados para emprender
          </p>
        </div>

        {/* Formulario */}
        <div style={{ padding: '32px' }}>
          {error && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                padding: '12px 14px',
                borderRadius: '8px',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '20px',
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {registering && <>
              <div className="form-group"><label className="form-label">¿Cómo vas a usar Emprende?</label><RoleChoice compact value={registration.role} onChange={(role) => setRegistration({ ...registration, role })} /></div>
              <div className="form-group"><label className="form-label">Nombre</label><input className="form-input" required maxLength={80} value={registration.name} onChange={(e) => setRegistration({ ...registration, name: e.target.value })} autoComplete="given-name" /></div>
              <div className="form-group"><label className="form-label">Apellido</label><input className="form-input" required maxLength={80} value={registration.lastName} onChange={(e) => setRegistration({ ...registration, lastName: e.target.value })} autoComplete="family-name" /></div>
              <div className="form-group"><label className="form-label"><User size={15} /> Nombre de usuario</label><input className="form-input" required minLength={3} maxLength={30} pattern="[A-Za-z0-9._-]+" value={registration.username} onChange={(e) => setRegistration({ ...registration, username: e.target.value })} autoComplete="username" /></div>
              <div className="form-group"><label className="form-label"><Mail size={15} /> Correo electrónico</label><input className="form-input" type="email" required maxLength={120} value={registration.email} onChange={(e) => setRegistration({ ...registration, email: e.target.value })} autoComplete="email" /></div>
            </>}
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {!registering && <><User size={15} className="text-muted" /> Usuario o Correo Electrónico</>}
              </label>
              {!registering && <input
                type="text"
                className="form-input"
                placeholder="ej: admin o admin@comercio.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoFocus
              />}
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={15} className="text-muted" /> Contraseña
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder={registering ? 'Al menos 8 caracteres' : 'Ingrese su contraseña'}
                  minLength={registering ? 8 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: '40px' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                  }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg w-full mt-4"
              disabled={loading}
              style={{ fontWeight: 700 }}
            >
              {loading ? (
                <>
                  <span className="spinner" /> Validando acceso...
                </>
              ) : (
                <>
                  {registering ? 'Crear cuenta' : 'Iniciar sesión'} <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <GoogleSignInButton
            text={registering ? 'signup_with' : 'signin_with'}
            onSuccess={login}
            onError={setError}
          />

          <div style={{ marginTop: '20px', textAlign: 'center', color: '#64748b', fontSize: '.82rem' }}>
            {registering ? '¿Ya tenés cuenta?' : '¿Primera vez en la plataforma?'}{' '}
            <button type="button" onClick={changeMode} style={{ border: 0, background: 'none', color: '#176a4a', fontWeight: 700, cursor: 'pointer' }}>{registering ? 'Iniciar sesión' : 'Crear cuenta'}</button>
          </div>
          {registering && <p style={{ marginTop: 12, textAlign: 'center', color: '#7a8a80', fontSize: '.7rem', lineHeight: 1.45 }}>Si te registrás con Google, te preguntamos el tipo de cuenta al entrar por primera vez.</p>}
        </div>


      </div>
    </div>
  );
};
