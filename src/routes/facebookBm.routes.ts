import express from 'express';
import facebookBmController from '../controllers/facebookBm.controller';

const router = express.Router();
router.post('/facebook-bm', facebookBmController.createBM);
router.get('/facebook-bm', facebookBmController.getAllFacebookBM);
router.delete('/facebook-bm', facebookBmController.deleteFacebookBm);
router.post('/facebook-bm-update', facebookBmController.updateFacebookBM);
export default router;
