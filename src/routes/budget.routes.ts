import express from 'express';
import budgetController from '../controllers/budget.controller';
import { requireRoles } from '../middlewares/auth.middleware';
import UserRole from '../constants/UserRole';

const router = express.Router();
router.post(
  '/budget',
  requireRoles([UserRole.ADMIN]),
  budgetController.createBudget,
);
router.get('/budget', budgetController.getAllBudgets);
router.put(
  '/budget/:id',
  requireRoles([UserRole.ADMIN]),
  budgetController.updatebudget,
);
router.get(
  '/budget/:id',
  requireRoles([UserRole.ADMIN]),
  budgetController.getbudgetById,
);
router.delete(
  '/budget/:id',
  requireRoles([UserRole.ADMIN]),
  budgetController.deletebudget,
);
export default router;
