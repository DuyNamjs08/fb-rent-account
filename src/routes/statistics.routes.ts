import express from 'express';
import statisticsController from '../controllers/statistics.controller';
import { requireRoles } from '../middlewares/auth.middleware';
import UserRole from '../constants/UserRole';
const router = express.Router();
router.get(
  '/statistics',
  requireRoles([UserRole.ADMIN]),
  statisticsController.getStatistics,
);
router.get(
  '/monthlyStatistics',
  requireRoles([UserRole.ADMIN]),
  statisticsController.getStatisticsMonthly,
);
export default router;
