import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  login, register, getMe, updateProfile, changePassword, googleConfig, googleLogin, completeOnboarding,
} from '../controllers/authController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = Router();

const limiterMessage = { message: 'Demasiados intentos. Esperá unos minutos y volvé a intentar.' };

// Intentos de ingreso: 10 cada 15 minutos por IP (los exitosos no cuentan).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: limiterMessage,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: limiterMessage,
});

const googleConfigLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: limiterMessage,
});

const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: limiterMessage,
});

router.post('/login', loginLimiter, login);
router.post('/register', registerLimiter, register);
router.get('/google/config', googleConfigLimiter, googleConfig);
router.post('/google', loginLimiter, googleLogin);
router.get('/me', authenticateToken, getMe);
router.post('/onboarding', authenticateToken, completeOnboarding);
router.put('/profile', authenticateToken, updateProfile);
router.put('/change-password', authenticateToken, passwordLimiter, changePassword);

export default router;
