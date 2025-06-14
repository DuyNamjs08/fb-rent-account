import express from 'express';
import { uploadMiddleware } from '../middlewares/upload.middleware';
import supportController from '../controllers/support.controller';
import { requireRoles } from '../middlewares/auth.middleware';
import UserRole from '../constants/UserRole';

const router = express.Router();

router.get('/support', supportController.getAllSupport);
router.get('/support/:id', supportController.getSupportById);
router.post(
  '/support',
  requireRoles([UserRole.ADMIN]),
  uploadMiddleware.array('attachments', 5),
  supportController.createSupport,
);
router.delete(
  '/support/:id',
  requireRoles([UserRole.ADMIN]),
  supportController.deleteSupport,
);

export default router;
