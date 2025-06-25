import express from 'express';
import { requireRoles } from '../middlewares/auth.middleware';
import UserRole from '../constants/UserRole';
import ConfigController from '../controllers/configs.controller';

const router = express.Router();
router.post(
  '/configs',
  requireRoles([UserRole.ADMIN]),
  ConfigController.createConfig,
);
router.get('/configs', ConfigController.getConfigs);
router.delete(
  '/configs',
  requireRoles([UserRole.ADMIN]),
  ConfigController.deleteConfigs,
);
export default router;
