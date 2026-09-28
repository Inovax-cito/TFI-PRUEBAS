import { Router } from 'express';
import {
  getCurrentRegister,
  openRegister,
  closeRegister,
  createManualMovement,
  getCashHistory,
} from '../controllers/cashController.js';
import { authenticateToken, requireAdmin } from '../middlewares/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/current', getCurrentRegister);
router.post('/open', openRegister);
router.post('/close', closeRegister);
router.post('/movements', createManualMovement);
router.get('/history', requireAdmin, getCashHistory);

export default router;
