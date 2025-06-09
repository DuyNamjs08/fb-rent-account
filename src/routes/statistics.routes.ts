import express from 'express';
import statisticsController from '../controllers/statistics.controller';
const router = express.Router();
router.get('/statistics', statisticsController.getStatistics);
export default router;
