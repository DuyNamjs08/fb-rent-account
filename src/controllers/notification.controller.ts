import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { errorResponse } from '../helpers/response';
import { httpStatusCodes } from '../helpers/statusCodes';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { z } from 'zod';
const createNotificationSchema = z.object({
  user_id: z.string().min(1, 'user_id là bắt buộc'),
  title: z.string().min(1, 'title là bắt buộc'),
  content: z.string().min(1, 'content là bắt buộc'),
  type: z.string().min(1, 'type là bắt buộc'),
  action_url: z.string().url('action_url phải là một URL hợp lệ').optional(),
});
const getIdSchema = z.object({
  id: z.string().min(1, 'id là bắt buộc'),
});
const getUserIdSchema = z.object({
  user_id: z.string().min(1, 'user_id là bắt buộc'),
});
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
      const parsed = createNotificationSchema.safeParse(req.body);
      if (!parsed.success) {
        const errors = parsed.error.flatten().fieldErrors;
        errorResponse(
          res,
          'Dữ liệu không hợp lệ',
          errors,
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
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
    try {
      const { id } = req.params;
      const parsed = getIdSchema.safeParse({ id });
      if (!parsed.success) {
        const errors = parsed.error.flatten().fieldErrors;
        errorResponse(
          res,
          'Dữ liệu không hợp lệ',
          errors,
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
      const noti = await prisma.notification.findUnique({ where: { id } });
      if (!noti) {
        res.status(404).json({ message: 'Thông báo không tồn tại.' });
        return;
      }
      await prisma.notification.update({
        where: { id },
        data: { is_read: true },
      });
      const updatedNotifications = await prisma.notification.findMany({
        where: { user_id: noti.user_id },
        orderBy: { created_at: 'desc' },
      });
      // Định dạng thời gian
      const formatted = updatedNotifications.map((n) => ({
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
  markAllAsRead: async (req: Request, res: Response): Promise<void> => {
    const { user_id } = req.query;
    try {
      // Cập nhật tất cả thông báo chưa đọc thành đã đọc
      const parsed = getUserIdSchema.safeParse({ user_id });
      if (!parsed.success) {
        const errors = parsed.error.flatten().fieldErrors;
        errorResponse(
          res,
          'Dữ liệu không hợp lệ',
          errors,
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
      await prisma.notification.updateMany({
        where: {
          user_id: user_id as string,
          is_read: false,
        },
        data: {
          is_read: true,
        },
      });
      // Lấy lại toàn bộ danh sách đã cập nhật
      const updatedNotifications = await prisma.notification.findMany({
        where: {
          user_id: user_id as string,
        },
        orderBy: { created_at: 'desc' },
      });
      // Format thời gian
      const formatted = updatedNotifications.map((n) => ({
        ...n,
        time: formatDistanceToNow(new Date(n.created_at), {
          addSuffix: true,
          locale: vi,
        }),
      }));
      res.status(200).json(formatted);
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
      const parsed = getIdSchema.safeParse({ id });
      if (!parsed.success) {
        const errors = parsed.error.flatten().fieldErrors;
        errorResponse(
          res,
          'Dữ liệu không hợp lệ',
          errors,
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
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
