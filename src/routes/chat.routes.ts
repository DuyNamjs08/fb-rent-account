import express from 'express';
import { requireRoles } from '../middlewares/auth.middleware';
import UserRole from '../constants/UserRole';
import ChatController from '../controllers/chat.controller';

const router = express.Router();
router.post(
  '/chat',
  requireRoles([UserRole.ADMIN, UserRole.USER]),
  ChatController.createChat,
);
router.get(
  '/chat-messages',
  requireRoles([UserRole.ADMIN, UserRole.USER]),
  ChatController.getAllChatMessageByUserId,
);
router.get(
  '/chat',
  requireRoles([UserRole.ADMIN, UserRole.USER]),
  ChatController.getAllChatByUserId,
);
export default router;
