import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpStatusCodes } from '../helpers/statusCodes';
import prisma from '../config/prisma';
import { httpReasonCodes } from '../helpers/reasonPhrases';
import { z } from 'zod';
const createCookieSchema = z.object({
  email: z.string().min(1, 'Email là bắt buộc').email('Email không hợp lệ'),
  storage_state: z.array(z.any()).refine((arr) => arr.length > 0, {
    message: 'Cần ít nhất một phần tử mô tả',
  }),
});
const getIdSchema = z.object({
  id: z.string().min(1, 'id là bắt buộc'),
});
const cookieController = {
  createCookie: async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, storage_state } = req.body;
      const parsed = createCookieSchema.safeParse(req.body);
      if (!parsed.success) {
        const errors = parsed.error.flatten().fieldErrors;
        errorResponse(
          res,
          'Dữ liệu không hợp lệ',
          errors,
          httpStatusCodes.INTERNAL_SERVER_ERROR,
        );
        return;
      }
      const cookies = await prisma.cookies.findUnique({
        where: {
          email: email,
        },
      });
      let cookieNew = {};
      if (cookies) {
        cookieNew = await prisma.cookies.update({
          where: { email },
          data: {
            storage_state,
          },
        });
      } else {
        cookieNew = await prisma.cookies.create({
          data: {
            email,
            storage_state,
          },
        });
      }
      successResponse(res, 'Tạo cookies thành công', cookieNew);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },

  getAllCookies: async (req: Request, res: Response): Promise<void> => {
    try {
      const cookies = await prisma.cookies.findMany({});
      successResponse(res, 'Danh sách cookies', cookies);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  deleteCookies: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id;
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
      const cookiesExist = await prisma.cookies.findUnique({
        where: { id: id },
      });
      if (!cookiesExist) {
        errorResponse(res, httpReasonCodes.NOT_FOUND, {}, 404);
        return;
      }

      const cookie = await prisma.cookies.delete({
        where: { id: id },
        select: {
          email: true,
        },
      });
      successResponse(res, 'Xóa cookie thành công !', cookie);
    } catch (error: any) {
      const statusCode = error.message.includes('not found') ? 404 : 400;
      if (statusCode === 404) {
        errorResponse(res, httpReasonCodes.NOT_FOUND, error, statusCode);
      } else {
        errorResponse(res, error?.message, error, statusCode);
      }
    }
  },
};

export default cookieController;
