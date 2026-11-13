import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createReport, getOverview, listReports, listUsers, resolveReport, updateUserAccess } from '../controllers/platformController.js';
import { authenticateToken, requireAdmin } from '../middlewares/auth.js';

const router = Router();
const reportLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Hiciste muchas denuncias seguidas. Esperá un rato.' } });

router.use(authenticateToken);
router.post('/reports', reportLimiter, createReport);
router.get('/overview', requireAdmin, getOverview);
router.get('/reports', requireAdmin, listReports);
router.patch('/reports/:id', requireAdmin, resolveReport);
router.get('/users', requireAdmin, listUsers);
router.patch('/users/:id', requireAdmin, updateUserAccess);

export default router;
