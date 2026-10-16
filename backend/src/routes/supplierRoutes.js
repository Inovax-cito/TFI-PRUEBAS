import { Router } from 'express';
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  toggleSupplierStatus,
} from '../controllers/supplierController.js';
import { authenticateToken, requireAdmin, requireStaff } from '../middlewares/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/', requireStaff, getSuppliers);
router.get('/:id', requireStaff, getSupplierById);
router.post('/', requireAdmin, createSupplier);
router.put('/:id', requireAdmin, updateSupplier);
router.patch('/:id/toggle-status', requireAdmin, toggleSupplierStatus);

export default router;
