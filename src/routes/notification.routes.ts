import express from 'express';
import notificationController from '../controllers/notification.controller';

const router = express.Router();
router.get('/notification-all', notificationController.getAllNotifications);
router.post('/notification', notificationController.createNotification);
router.put(
  '/notification/:id/read',
  notificationController.markAsReadNotification,
);
router.put('/notification/mark-all-read', notificationController.markAllAsRead);
router.delete(
  '/notification/deleted/:id',
  notificationController.deleteNotification,
);

export default router;
