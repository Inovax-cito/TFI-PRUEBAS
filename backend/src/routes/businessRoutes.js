import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  createOrder, createProduct, deleteBusinessPhoto, getOverview, listOrders, listProducts,
  setOrderStatus, updateProduct, uploadBusinessPhoto, uploadProductPhoto,
} from '../controllers/businessController.js';
import { closeDay, createExpense, getCurrentDay, listDays, openDay } from '../controllers/cashDayController.js';
import { authenticateToken, requireEntrepreneur } from '../middlewares/auth.js';
import { singleFile } from '../config/uploads.js';

const router = Router();
const uploadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Demasiadas subidas seguidas. Esperá unos minutos.' } });

router.use(authenticateToken, requireEntrepreneur);
router.get('/overview', getOverview);
router.post('/photos', uploadLimiter, singleFile, uploadBusinessPhoto);
router.delete('/photos/:id', deleteBusinessPhoto);
router.get('/products', listProducts);
router.post('/products', createProduct);
router.put('/products/:id', updateProduct);
router.post('/products/:id/photo', uploadLimiter, singleFile, uploadProductPhoto);
router.get('/orders', listOrders);
router.post('/orders', createOrder);
router.patch('/orders/:id/status', setOrderStatus);
router.get('/cash/current', getCurrentDay);
router.post('/cash/open', openDay);
router.post('/cash/close', closeDay);
router.get('/cash/history', listDays);
router.post('/expenses', createExpense);

export default router;
