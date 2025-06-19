import express from 'express';
import visaController from '../controllers/fbVisa.controller';

const router = express.Router();
router.post('/visa', visaController.createAndUpadateVisa);
router.post('/visa-add-card', visaController.createPointUsedVisa);
router.post('/visa-repeat', visaController.repeatJobVisa);
router.post('/visa-remove', visaController.deleteVisa);

export default router;
