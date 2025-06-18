import express from 'express';
import visaController from '../controllers/fbVisa.controller';

const router = express.Router();
router.post('/visa', visaController.createAndUpadateVisa);

export default router;
