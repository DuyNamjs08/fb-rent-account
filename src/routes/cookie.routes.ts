import express from 'express';
import cookieController from '../controllers/cookies.controller';
import { requireRoles } from '../middlewares/auth.middleware';
import UserRole from '../constants/UserRole';
const router = express.Router();
router.post(
  '/cookies',
  requireRoles([UserRole.ADMIN]),
  cookieController.createCookie,
);
router.get('/cookies', cookieController.getAllCookies);
router.delete(
  '/cookies/:id',
  requireRoles([UserRole.ADMIN]),
  cookieController.deleteCookies,
);
export default router;
