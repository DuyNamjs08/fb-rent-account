import express from 'express';
import pointUsedController from '../controllers/pointUsed.controller';
const router = express.Router();
router.post('/points-used', pointUsedController.createPointUsed);
router.get('/points-used', pointUsedController.getAllPointsByUserId);
router.get('/points-used-all', pointUsedController.getAllpoints);
router.delete('/points-used', pointUsedController.deleteUserUsedPoint);
router.post('/check-spending', pointUsedController.checkSpending);
export default router;
