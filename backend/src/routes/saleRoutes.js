import { Router } from 'express';
import {
  getSales,
  getSaleById,
  createSale,
  cancelSale,
} from '../controllers/saleController.js';
import { authenticateToken, requireAdmin, requireStaff } from '../middlewares/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/', requireStaff, getSales);
router.get('/:id', requireStaff, getSaleById);
router.post('/', createSale);
router.post('/:id/cancel', requireAdmin, cancelSale);

export default router;
