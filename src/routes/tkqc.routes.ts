import express from 'express';
import TKQCController from '../controllers/adAccount.controller';
import { requireRoles } from '../middlewares/auth.middleware';
import UserRole from '../constants/UserRole';
const router = express.Router();
router.post(
  '/async-ad-accounts',
  requireRoles([UserRole.ADMIN]),
  TKQCController.asyncTKQC,
);
router.get('/ad-accounts', TKQCController.getAllTKQC);
router.get('/ads-rent-accounts', TKQCController.getAdsRentedByUser);
router.get(
  '/ads-rent-accounts-all',
  requireRoles([UserRole.ADMIN]),
  TKQCController.getAdsRented,
);
export default router;
