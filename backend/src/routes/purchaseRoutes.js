import { Router } from 'express';
import {
  getPurchases,
  getPurchaseById,
  createPurchase,
  receivePurchase,
  cancelPurchase,
} from '../controllers/purchaseController.js';
import { authenticateToken, requireAdmin } from '../middlewares/auth.js';

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/', getPurchases);
router.get('/:id', getPurchaseById);
router.post('/', createPurchase);
router.post('/:id/receive', receivePurchase);
router.post('/:id/cancel', cancelPurchase);

export default router;
