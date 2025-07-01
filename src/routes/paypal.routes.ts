import express from 'express';
import paypalController from '../controllers/paypal.controller';

const router = express.Router();
router.post('/paypal/webhook', paypalController.createPaypalWebhook);
router.post('/paypal/payment', paypalController.paypalOrder);
router.post('/paypal/verify', paypalController.paypalCapture);
export default router;
