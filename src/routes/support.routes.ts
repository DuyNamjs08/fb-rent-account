import express from 'express';
import { uploadMiddleware } from '../middlewares/upload.middleware';
import supportController from '../controllers/support.controller';
import { requireRoles } from '../middlewares/auth.middleware';
import UserRole from '../constants/UserRole';
import {setLanguageFromConfig} from "../middlewares/setLanguageFromConfig";

const router = express.Router();

router.get('/support', supportController.getAllSupport);
router.get('/support/:id', supportController.getSupportById);
router.get('/support/user/:id', supportController.getSupportByUserId);
router.post(
  '/support',
  uploadMiddleware.array('attachments', 5),
  supportController.createSupport,
);
router.patch('/support/status/:id', supportController.updateStatusByRequestId);
router.post('/support/message', supportController.createMessage);
router.get('/support/message/:id', supportController.getMessageByRequestId);
router.delete('/support/:id', supportController.deleteSupport);

// send mail
router.post(
  '/support/mail-admin',
  setLanguageFromConfig,
  supportController.sendMailAdmin,
);
router.post(
  '/support/mail-user',
  setLanguageFromConfig,
  supportController.sendMailUser,
);

export default router;
