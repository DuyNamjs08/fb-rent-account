import express from 'express';
import transactionController from '../controllers/transactions.controller';
const router = express.Router();
router.post('/transaction', transactionController.createTransactionV2);
export default router;
