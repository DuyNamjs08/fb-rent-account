import express from 'express';
import testController from '../controllers/test.controller';

const router = express.Router();
router.post('/test', testController.createtest);

export default router;
