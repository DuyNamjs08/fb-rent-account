import express from 'express';
import pointUsedController from '../controllers/pointUsed.controller';
const router = express.Router();
router.post('/points-used', pointUsedController.createPointUsed);
router.get('/points-used', pointUsedController.getAllRolesByUserId);
export default router;
