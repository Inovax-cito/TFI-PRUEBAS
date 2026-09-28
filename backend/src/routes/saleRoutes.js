import { Router } from 'express';
import {
  getSales,
  getSaleById,
  createSale,
  cancelSale,
} from '../controllers/saleController.js';
import { authenticateToken, requireAdmin } from '../middlewares/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/', getSales);
router.get('/:id', getSaleById);
router.post('/', createSale);
router.post('/:id/cancel', requireAdmin, cancelSale);

export default router;
