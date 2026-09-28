import { Router } from 'express';
import {
  getUsers,
  createUser,
  updateUser,
  toggleStatus,
  deleteUser,
} from '../controllers/userController.js';
import { authenticateToken, requireAdmin } from '../middlewares/auth.js';

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/', getUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.patch('/:id/toggle-status', toggleStatus);
router.delete('/:id', deleteUser);

export default router;
