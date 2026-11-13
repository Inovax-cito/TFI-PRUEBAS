import { Router } from 'express';
import { getPrivateFile, getPublicFile } from '../controllers/fileController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = Router();
router.get('/public/:key', getPublicFile);
router.get('/private/:id', authenticateToken, getPrivateFile);

export default router;
