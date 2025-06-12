import express from 'express';
import cookieController from '../controllers/cookies.controller';
const router = express.Router();
router.post('/cookies', cookieController.createCookie);
router.get('/cookies', cookieController.getAllCookies);
router.delete('/cookies/:id', cookieController.deleteCookies);
export default router;
