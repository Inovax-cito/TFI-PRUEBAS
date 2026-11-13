import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  adminListSpaces, createSpace, deleteSpaceDocument, listMySpaces, reviewSpace, updateSpace, uploadSpaceCover, uploadSpaceDocument,
} from '../controllers/spaceController.js';
import { authenticateToken, requireAdmin, requireOrganizer } from '../middlewares/auth.js';
import { singleFile } from '../config/uploads.js';

const router = Router();
const uploadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Demasiadas subidas seguidas. Esperá unos minutos.' } });

router.use(authenticateToken);
router.get('/mine', requireOrganizer, listMySpaces);
router.post('/', requireOrganizer, createSpace);
router.put('/:id', requireOrganizer, updateSpace);
router.post('/:id/documents', requireOrganizer, uploadLimiter, singleFile, uploadSpaceDocument);
router.delete('/:id/documents/:documentId', requireOrganizer, deleteSpaceDocument);
router.post('/:id/cover', requireOrganizer, uploadLimiter, singleFile, uploadSpaceCover);
router.get('/admin/all', requireAdmin, adminListSpaces);
router.patch('/admin/:id/review', requireAdmin, reviewSpace);

export default router;
