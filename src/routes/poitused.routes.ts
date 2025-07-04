import express from 'express';
import pointUsedController from '../controllers/pointUsed.controller';
import { requireRoles } from '../middlewares/auth.middleware';
import UserRole from '../constants/UserRole';
const router = express.Router();
router.post(
  '/points-used',
  requireRoles([UserRole.USER, UserRole.ADMIN]),
  pointUsedController.createPointUsed,
);
router.get(
  '/points-used',
  requireRoles([UserRole.USER, UserRole.ADMIN]),
  pointUsedController.getAllPointsByUserId,
);
router.get(
  '/points-used-all',
  requireRoles([UserRole.ADMIN]),
  pointUsedController.getAllpoints,
);
router.delete(
  '/points-used',
  requireRoles([UserRole.USER, UserRole.ADMIN]),
  pointUsedController.deleteUserUsedPoint,
);
router.post('/check-spending', pointUsedController.checkSpending);
export default router;
