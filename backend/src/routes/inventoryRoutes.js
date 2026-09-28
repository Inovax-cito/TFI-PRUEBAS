import { Router } from 'express';
import {
  getInventorySummary,
  getInventoryMovements,
  createAdjustment,
  getLowStockProducts,
} from '../controllers/inventoryController.js';
import { authenticateToken, requireAdmin } from '../middlewares/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/summary', getInventorySummary);
router.get('/movements', getInventoryMovements);
router.get('/low-stock', getLowStockProducts);
router.post('/adjustments', requireAdmin, createAdjustment);

export default router;
