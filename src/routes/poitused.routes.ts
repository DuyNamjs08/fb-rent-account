import express from 'express';
import pointUsedController from '../controllers/pointUsed.controller';
const router = express.Router();
router.post('/points-used', pointUsedController.createPointUsed);
export default router;
