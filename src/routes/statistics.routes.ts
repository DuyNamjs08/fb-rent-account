import express from 'express';
import statisticsController from '../controllers/statistics.controller';
const router = express.Router();
router.get('/statistics', statisticsController.getStatistics);
router.get('/monthlyStatistics', statisticsController.getStatisticsMonthly);
export default router;
