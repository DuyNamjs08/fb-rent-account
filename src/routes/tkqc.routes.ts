import express from 'express';
import TKQCController from '../controllers/adAccount.controller';
const router = express.Router();
router.post('/async-ad-accounts', TKQCController.asyncTKQC);
router.get('/ad-accounts', TKQCController.getAllTKQC);
router.get('/ads-rent-accounts', TKQCController.getAdsRentedByUser);
router.get('/ads-rent-accounts-all', TKQCController.getAdsRented);
export default router;
