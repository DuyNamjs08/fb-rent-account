import express from 'express';
import cookieController from '../controllers/cookies.controller';
const router = express.Router();
router.post('/cookies', cookieController.createCookie);
router.get('/cookies', cookieController.getAllCookies);
export default router;
