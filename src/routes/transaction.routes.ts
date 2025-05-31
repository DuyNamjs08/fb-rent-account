import express from 'express';
import transactionController from '../controllers/transactions.controller';
const router = express.Router();
router.post('/transaction', transactionController.createTransactionV2);
router.get('/transaction', transactionController.getAlltransactionsByUserId);
router.get('/transaction-all', transactionController.getAlltransactions);
export default router;
