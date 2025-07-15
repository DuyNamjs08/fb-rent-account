import express from 'express';
import { requireRoles } from '../middlewares/auth.middleware';
import UserRole from '../constants/UserRole';
import AdAwardsController from '../controllers/adAward.controller';
import { uploadExcel } from '../middlewares/uploadExcel.middleware';

const router = express.Router();
router.post(
  '/ad_rewards',
  //   requireRoles([UserRole.ADMIN]),
  uploadExcel.single('file'),
  AdAwardsController.createAdAwards,
);
router.get('/ad_rewards', AdAwardsController.getAllAdAwardss);

export default router;
