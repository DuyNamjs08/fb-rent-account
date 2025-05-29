import express from 'express';
import TKQCController from '../controllers/adAccount.controller';
const router = express.Router();
router.post('/async-ad-accounts', TKQCController.asyncTKQC);
router.get('/ad-accounts', TKQCController.getAllTKQC);
export default router;
