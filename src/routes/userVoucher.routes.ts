import express from 'express';
import userVoucherController from '../controllers/userVoucher.controller';
import { requireRoles } from '../middlewares/auth.middleware';
import UserRole from '../constants/UserRole';

const router = express.Router();
// Gán voucher cho user
router.patch(
  '/assign-voucher',
  requireRoles([UserRole.ADMIN]),
  userVoucherController.bulkToggleAssignVouchers,
);
router.get('/my-vouchers', userVoucherController.getMyVouchers);
// Lấy danh sách tất cả voucher kể cả voucher user đã sở hữu
router.get(
  '/all-vouchers/:user_id',
  requireRoles([UserRole.ADMIN]),
  userVoucherController.getAllVouchers,
);
// lấy ra danh sách người dùng thuộc voucher id
router.get(
  '/vouchers/:id/assigned-users',
  requireRoles([UserRole.ADMIN]),
  userVoucherController.getAssignedUsers,
);

export default router;
