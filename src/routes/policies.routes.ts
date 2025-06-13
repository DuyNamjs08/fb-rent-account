import express from 'express';
import policiesController from '../controllers/policies.controller';
import UserRole from '../constants/UserRole';
import { requireRoles } from '../middlewares/auth.middleware';

const router = express.Router();
router.post(
  '/policies',
  requireRoles([UserRole.ADMIN]),
  policiesController.createPolicies,
);
router.get('/policies', policiesController.getAllpoliciess);
router.put(
  '/policies/:id',
  requireRoles([UserRole.ADMIN]),
  policiesController.updatePolicies,
);
router.get('/policies/:id', policiesController.getPoliciesById);
router.delete(
  '/policies/:id',
  requireRoles([UserRole.ADMIN]),
  policiesController.deletePolicies,
);
export default router;
