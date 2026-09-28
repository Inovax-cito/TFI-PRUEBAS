import { Router } from 'express';
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  toggleSupplierStatus,
} from '../controllers/supplierController.js';
import { authenticateToken, requireAdmin } from '../middlewares/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/', getSuppliers);
router.get('/:id', getSupplierById);
router.post('/', requireAdmin, createSupplier);
router.put('/:id', requireAdmin, updateSupplier);
router.patch('/:id/toggle-status', requireAdmin, toggleSupplierStatus);

export default router;
