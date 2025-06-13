import express from 'express';
import transactionController from '../controllers/transactions.controller';
import { requireRoles } from '../middlewares/auth.middleware';
import UserRole from '../constants/UserRole';
const router = express.Router();
router.post('/transaction', transactionController.createTransactionV2);
router.get('/transaction', transactionController.getAlltransactionsByUserId);
router.get(
  '/transaction-all',
  requireRoles([UserRole.ADMIN]),
  transactionController.getAlltransactions,
);
export default router;
