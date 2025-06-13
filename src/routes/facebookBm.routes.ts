import express from 'express';
import facebookBmController from '../controllers/facebookBm.controller';
import { requireRoles } from '../middlewares/auth.middleware';
import UserRole from '../constants/UserRole';

const router = express.Router();
router.post(
  '/facebook-bm',
  requireRoles([UserRole.ADMIN]),
  facebookBmController.createBM,
);
router.get('/facebook-bm', facebookBmController.getAllFacebookBM);
router.delete(
  '/facebook-bm',
  requireRoles([UserRole.ADMIN]),
  facebookBmController.deleteFacebookBm,
);
router.post(
  '/facebook-bm-update',
  requireRoles([UserRole.ADMIN]),
  facebookBmController.updateFacebookBM,
);
export default router;
