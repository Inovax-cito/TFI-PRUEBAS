import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { JWT_SECRET } from './security.js';

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim() || '';
export const isGoogleEnabled = () => Boolean(GOOGLE_CLIENT_ID);

const client = new OAuth2Client();
const VALID_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const NONCE_TTL_SECONDS = 10 * 60;

// Registro en memoria de nonces y ID tokens ya usados (evita la repetición de un mismo token).
const usedNonces = new Map();
const usedTokenIds = new Map();

const purgeExpired = () => {
  const now = Date.now();
  for (const [key, expiresAt] of usedNonces) if (expiresAt <= now) usedNonces.delete(key);
  for (const [key, expiresAt] of usedTokenIds) if (expiresAt <= now) usedTokenIds.delete(key);
};
setInterval(purgeExpired, 5 * 60 * 1000).unref();

/**
 * Genera un nonce aleatorio y un comprobante firmado por el servidor.
 * El nonce viaja a Google y vuelve dentro del ID token; el comprobante
 * permite al backend confirmar que ese nonce lo emitió él y no fue usado antes.
 */
export const createGoogleNonce = () => {
  const nonce = crypto.randomBytes(32).toString('base64url');
  const nonceToken = jwt.sign({ nonce, purpose: 'google-login' }, JWT_SECRET, {
    expiresIn: NONCE_TTL_SECONDS,
    algorithm: 'HS256',
    issuer: 'emprende',
    audience: 'emprende-google-nonce',
  });
  return { nonce, nonceToken };
};

export class GoogleAuthError extends Error {}

/** Verifica el ID token de Google y devuelve los datos confiables del usuario. */
export const verifyGoogleCredential = async (credential, nonceToken) => {
  if (!isGoogleEnabled()) throw new GoogleAuthError('El ingreso con Google no está habilitado.');
  if (typeof credential !== 'string' || credential.length > 4096 || typeof nonceToken !== 'string' || nonceToken.length > 1024) {
    throw new GoogleAuthError('Solicitud de ingreso inválida.');
  }

  let nonceClaims;
  try {
    nonceClaims = jwt.verify(nonceToken, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'emprende',
      audience: 'emprende-google-nonce',
    });
  } catch {
    throw new GoogleAuthError('La solicitud de ingreso venció. Intentá nuevamente.');
  }
  if (nonceClaims.purpose !== 'google-login' || typeof nonceClaims.nonce !== 'string') {
    throw new GoogleAuthError('Solicitud de ingreso inválida.');
  }

  let payload;
  try {
    // Valida firma (claves públicas de Google), audiencia (nuestro Client ID) y vencimiento.
    const ticket = await client.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    throw new GoogleAuthError('No se pudo validar la cuenta de Google.');
  }

  if (!payload || !VALID_ISSUERS.includes(payload.iss)) throw new GoogleAuthError('Emisor del token no válido.');
  if (payload.aud !== GOOGLE_CLIENT_ID) throw new GoogleAuthError('El token no fue emitido para esta aplicación.');
  if (!payload.sub) throw new GoogleAuthError('Token de Google incompleto.');
  if (payload.nonce !== nonceClaims.nonce) throw new GoogleAuthError('La solicitud de ingreso no coincide. Intentá nuevamente.');
  if (!payload.email || payload.email_verified !== true) {
    throw new GoogleAuthError('Tu cuenta de Google no tiene un correo verificado.');
  }

  purgeExpired();
  const tokenId = payload.jti || crypto.createHash('sha256').update(credential).digest('hex');
  if (usedNonces.has(nonceClaims.nonce) || usedTokenIds.has(tokenId)) {
    throw new GoogleAuthError('Este inicio de sesión ya fue utilizado. Intentá nuevamente.');
  }
  usedNonces.set(nonceClaims.nonce, nonceClaims.exp * 1000);
  usedTokenIds.set(tokenId, (payload.exp || nonceClaims.exp) * 1000);

  return {
    googleId: String(payload.sub),
    email: payload.email.trim().toLowerCase(),
    name: (payload.given_name || payload.name || '').trim().slice(0, 80),
    lastName: (payload.family_name || '').trim().slice(0, 80),
  };
};
