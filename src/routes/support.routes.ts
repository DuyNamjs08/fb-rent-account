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
  uploadMiddleware.array('attachments', 5),
  supportController.createSupport,
);
// router.delete('/support/:id', supportController.deleteSupport);
router.patch('/support/status/:id', supportController.updateStatusByRequestId);
router.post('/support/message', supportController.createMessage);
router.get('/support/message/:id', supportController.getMessageByRequestId);
router.delete('/support/:id', supportController.deleteSupport);

export default router;
