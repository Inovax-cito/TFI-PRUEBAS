import { Router } from 'express';
import {
  getInventorySummary,
  getInventoryMovements,
  createAdjustment,
  getLowStockProducts,
} from '../controllers/inventoryController.js';
import { authenticateToken, requireAdmin, requireStaff } from '../middlewares/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/summary', requireStaff, getInventorySummary);
router.get('/movements', requireStaff, getInventoryMovements);
router.get('/low-stock', requireStaff, getLowStockProducts);
router.post('/adjustments', requireAdmin, createAdjustment);

export default router;
