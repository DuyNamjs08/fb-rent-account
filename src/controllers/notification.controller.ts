import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { errorResponse } from '../helpers/response';
import { httpStatusCodes } from '../helpers/statusCodes';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

const notificationController = {
  getAllNotifications: async (req: Request, res: Response): Promise<void> => {
    const { user_id } = req.query;
    if (!user_id) {
      res.status(400).json({ message: 'Thiếu user_id' });
      return;
    }
    try {
      const notifications = await prisma.notification.findMany({
        where: {
          user_id: user_id as string,
        },
        orderBy: { created_at: 'desc' },
      });
      const formatted = notifications.map((n) => ({
        ...n,
        time: formatDistanceToNow(new Date(n.created_at), {
          addSuffix: true,
          locale: vi,
        }),
      }));
      res.status(200).json(formatted);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  createNotification: async (req: Request, res: Response): Promise<void> => {
    try {
      const { user_id, title, content, type, action_url } = req.body;
      const noti = await prisma.notification.create({
        data: { user_id, title, content, type, action_url },
      });
      res.status(201).json(noti);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  markAsReadNotification: async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const { id } = req.params;
    const updated = await prisma.notification.update({
      where: { id },
      data: { is_read: true },
    });
    res.json(updated);
  },
  markAllAsRead: async (req: Request, res: Response): Promise<void> => {
    const { user_id } = req.params;
    try {
      const result = await prisma.notification.updateMany({
        where: {
          user_id: user_id,
          is_read: false,
        },
        data: {
          is_read: true,
        },
      });
      res.status(200).json({
        message: `${result.count} thông báo đã được đánh dấu là đã đọc.`,
      });
    } catch (error: any) {
      console.error(error);
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  deleteNotification: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const noti = await prisma.notification.delete({
        where: { id },
      });
      res.status(200).json(noti);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
};
export default notificationController;
