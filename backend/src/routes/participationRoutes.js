import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  createReview, informPayment, listMessages, reviewPayment, saveStandPlan, sendMessage, setStand,
  simulatePayment, unreadSummary, withdrawApplication, organizerIncome, setAttendance,
} from '../controllers/participationController.js';
import { authenticateToken, requireEntrepreneur, requireOrganizer } from '../middlewares/auth.js';
import { singleFile } from '../config/uploads.js';

const router = Router();
const messageLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Estás enviando mensajes muy rápido. Esperá un momento.' } });

router.use(authenticateToken);
router.get('/unread', unreadSummary);
router.get('/organizer/income', requireOrganizer, organizerIncome);
router.get('/:id/messages', listMessages);
router.post('/:id/messages', messageLimiter, sendMessage);
router.post('/:id/withdraw', requireEntrepreneur, withdrawApplication);
router.post('/:id/review', createReview);
router.patch('/:id/stand', requireOrganizer, setStand);
router.patch('/:id/attendance', requireOrganizer, setAttendance);
router.post('/:id/payment/simulate', requireEntrepreneur, simulatePayment);
router.post('/:id/payment/inform', requireEntrepreneur, singleFile, informPayment);
router.patch('/:id/payment', requireOrganizer, reviewPayment);
router.put('/events/:id/plan', requireOrganizer, saveStandPlan);

export default router;
