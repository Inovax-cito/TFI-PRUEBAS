import { Router } from 'express';
import {
  getConfig,
  updateConfig,
  getPaymentMethods,
  createPaymentMethod,
  togglePaymentMethod,
} from '../controllers/configController.js';
import { authenticateToken, requireAdmin } from '../middlewares/auth.js';

const router = Router();

// Config general
router.get('/', authenticateToken, getConfig);
router.put('/', authenticateToken, requireAdmin, updateConfig);

// Métodos de pago
router.get('/payment-methods', authenticateToken, getPaymentMethods);
router.post('/payment-methods', authenticateToken, requireAdmin, createPaymentMethod);
router.patch('/payment-methods/:id/toggle', authenticateToken, requireAdmin, togglePaymentMethod);

export default router;
