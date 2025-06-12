import express from 'express';
import budgetController from '../controllers/budget.controller';

const router = express.Router();
router.post('/budget', budgetController.createBudget);
router.get('/budget', budgetController.getAllBudgets);
router.put('/budget/:id', budgetController.updatebudget);
router.get('/budget/:id', budgetController.getbudgetById);
router.delete('/budget/:id', budgetController.deletebudget);
export default router;
