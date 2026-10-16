import { Router } from 'express';
import {
  getDashboardMetrics,
  getSalesReport,
  getFinancialReport,
  getInventoryReport,
} from '../controllers/reportController.js';
import { authenticateToken, requireAdmin, requireStaff } from '../middlewares/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/dashboard', requireStaff, getDashboardMetrics);
router.get('/sales', requireAdmin, getSalesReport);
router.get('/financial', requireAdmin, getFinancialReport);
router.get('/inventory', requireAdmin, getInventoryReport);

export default router;
