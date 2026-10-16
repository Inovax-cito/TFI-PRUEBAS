import { Router } from 'express';
import {
  getCurrentRegister,
  openRegister,
  closeRegister,
  createManualMovement,
  getCashHistory,
} from '../controllers/cashController.js';
import { authenticateToken, requireAdmin, requireStaff } from '../middlewares/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/current', requireStaff, getCurrentRegister);
router.post('/open', requireStaff, openRegister);
router.post('/close', requireStaff, closeRegister);
router.post('/movements', createManualMovement);
router.get('/history', requireAdmin, getCashHistory);

export default router;
