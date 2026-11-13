import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../utils/api.js';

const GSI_SRC = 'https://accounts.google.com/gsi/client';
let gsiPromise = null;

const loadGoogleScript = () => {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gsiPromise) {
    gsiPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => { gsiPromise = null; reject(new Error('No se pudo cargar Google.')); };
      document.head.appendChild(script);
    });
  }
  return gsiPromise;
};

// Google bloquea el inicio de sesión dentro de WebViews (como la app Android), así que ahí no se muestra.
const isEmbeddedApp = () => Boolean(window.Capacitor?.isNativePlatform?.());

export const GoogleSignInButton = ({ onSuccess, onError, text = 'signin_with' }) => {
  const containerRef = useRef(null);
  const nonceTokenRef = useRef(null);
  const callbacksRef = useRef({ onSuccess, onError });
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const setupRef = useRef(null);

  useEffect(() => { callbacksRef.current = { onSuccess, onError }; }, [onSuccess, onError]);

  const setup = useCallback(async () => {
    // Cada intento usa un nonce nuevo emitido por el servidor (un solo uso).
    const config = await apiRequest('/auth/google/config');
    if (!config.enabled) { setEnabled(false); return; }
    await loadGoogleScript();
    nonceTokenRef.current = config.nonceToken;

    window.google.accounts.id.initialize({
      client_id: config.clientId,
      nonce: config.nonce,
      auto_select: false,
      cancel_on_tap_outside: true,
      itp_support: true,
      use_fedcm_for_button: true,
      callback: async ({ credential }) => {
        setBusy(true);
        try {
          const data = await apiRequest('/auth/google', {
            method: 'POST',
            body: { credential, nonceToken: nonceTokenRef.current },
          });
          callbacksRef.current.onSuccess?.(data);
        } catch (err) {
          callbacksRef.current.onError?.(err.message || 'No se pudo iniciar sesión con Google.');
          setupRef.current?.().catch(() => setEnabled(false));
        } finally {
          setBusy(false);
        }
      },
    });

    setEnabled(true);
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(containerRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text,
        logo_alignment: 'center',
        width: Math.min(containerRef.current.offsetWidth || 376, 400),
        locale: 'es',
      });
    }
  }, [text]);

  useEffect(() => {
    setupRef.current = setup;
    if (isEmbeddedApp()) return undefined;
    setup().catch(() => setEnabled(false));
    // El nonce vence a los 10 minutos: se renueva antes si la página queda abierta.
    const refresh = setInterval(() => setup().catch(() => setEnabled(false)), 9 * 60 * 1000);
    return () => { clearInterval(refresh); window.google?.accounts?.id?.cancel?.(); };
  }, [setup]);

  if (isEmbeddedApp()) return null;

  return (
    <div style={{ display: enabled ? 'block' : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 16px', color: '#94a3b8', fontSize: '.78rem' }}>
        <span style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
        o
        <span style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
      </div>
      <div ref={containerRef} style={{ width: '100%', display: 'flex', justifyContent: 'center', opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : 'auto' }} />
    </div>
  );
};

export default GoogleSignInButton;
