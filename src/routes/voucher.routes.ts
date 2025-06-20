import express from 'express';
import voucherController from '../controllers/voucher.controller';
import { requireRoles } from '../middlewares/auth.middleware';
import UserRole from '../constants/UserRole';

const router = express.Router();
router.post(
  '/voucher',
  requireRoles([UserRole.ADMIN]),
  voucherController.createVoucher,
);
router.get('/voucher', voucherController.getAllVouchers);
router.get('/voucher/:id', voucherController.getVoucherById);
router.put(
  '/voucher/:id',
  requireRoles([UserRole.ADMIN]),
  voucherController.updateVoucher,
);
router.delete(
  '/voucher/:id',
  requireRoles([UserRole.ADMIN]),
  voucherController.deleteVoucher,
);

export default router;
