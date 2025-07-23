import express from 'express';
import { requireRoles } from '../middlewares/auth.middleware';
import UserRole from '../constants/UserRole';
import AdAwardsController, {
  asyncAdAwards,
} from '../controllers/adAward.controller';
import { uploadExcel } from '../middlewares/uploadExcel.middleware';

const router = express.Router();
router.post(
  '/ad_rewards',
  requireRoles([UserRole.ADMIN]),
  uploadExcel.single('file'),
  AdAwardsController.createAdAwards,
);
router.get(
  '/ad_rewards',
  requireRoles([UserRole.ADMIN]),
  AdAwardsController.getAllAdAwards,
);
router.put(
  '/ad_rewards/:id',
  requireRoles([UserRole.ADMIN]),
  AdAwardsController.editReward,
);
router.post('/asyc_ad_rewards', requireRoles([UserRole.ADMIN]), asyncAdAwards);

export default router;
