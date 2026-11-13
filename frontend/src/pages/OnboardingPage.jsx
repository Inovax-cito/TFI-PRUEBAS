import React, { useState } from 'react';
import { ArrowRight, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../utils/api.js';
import { RoleChoice } from '../components/portal/RoleChoice.jsx';
import './MarketplacePage.css';
import './EmprendeTheme.css';
import './PortalExtras.css';

/** Primer ingreso con Google: la persona elige su rol (una única vez). */
export function OnboardingPage() {
  const { user, login, logout } = useAuth();
  const [role, setRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    if (!role) { setError('Elegí una opción para continuar.'); return; }
    setBusy(true); setError('');
    try {
      const data = await apiRequest('/auth/onboarding', { method: 'POST', body: { role } });
      login(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="emprende-portal-shell onboarding-page">
      <section className="onboarding-card">
        <span className="market-kicker">BIENVENIDA</span>
        <h1>Hola, {user?.name}. ¿Cómo vas a usar Emprende?</h1>
        <p>Elegilo una sola vez. Si después necesitás cambiarlo, lo puede hacer la administración.</p>
        <RoleChoice value={role} onChange={setRole} />
        {error && <p className="market-inline-message error" role="alert">{error}</p>}
        <div className="onboarding-actions">
          <button type="button" className="market-button outline" onClick={logout}><LogOut size={15} /> Salir</button>
          <button type="button" className="market-button primary" onClick={confirm} disabled={busy || !role}>
            {busy ? 'Guardando…' : 'Continuar'} <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}

export default OnboardingPage;
