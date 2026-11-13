import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET debe estar definido (mínimo 32 caracteres) en producción.');
}

// En desarrollo se permite un valor por defecto para no bloquear el arranque local.
export const JWT_SECRET = process.env.JWT_SECRET || 'solo_desarrollo_no_usar_en_produccion_jwt_secret';

export const SESSION_TOKEN_TTL = '24h';

export const signSessionToken = (user) => jwt.sign(
  { id: user.id, username: user.username, role: user.role },
  JWT_SECRET,
  { expiresIn: SESSION_TOKEN_TTL, algorithm: 'HS256', audience: 'emprende-api', issuer: 'emprende' },
);

export const verifySessionToken = (token) => jwt.verify(token, JWT_SECRET, {
  algorithms: ['HS256'],
  audience: 'emprende-api',
  issuer: 'emprende',
});
