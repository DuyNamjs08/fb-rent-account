import express from 'express';
import { uploadMiddleware } from '../middlewares/upload.middleware';
import supportController from '../controllers/support.controller';

const router = express.Router();

router.get('/support', supportController.getAllSupport);
router.get('/support/:id', supportController.getSupportById);
router.post(
  '/support',
  uploadMiddleware.array('attachments', 5),
  supportController.createSupport,
);
router.delete('/support/:id', supportController.deleteSupport);

router.post('/support/message', supportController.createMessage);
router.get('/support/message/:id', supportController.getMessageByRequestId);

export default router;
