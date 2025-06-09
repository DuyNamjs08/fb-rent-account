import express from 'express';
import policiesController from '../controllers/policies.controller';

const router = express.Router();
router.post('/policies', policiesController.createPolicies);
router.get('/policies', policiesController.getAllpoliciess);
router.put('/policies/:id', policiesController.updatePolicies);
router.get('/policies/:id', policiesController.getPoliciesById);
router.delete('/policies/:id', policiesController.deletePolicies);
export default router;
