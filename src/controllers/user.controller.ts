import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpReasonCodes } from '../helpers/reasonPhrases';
import { httpStatusCodes } from '../helpers/statusCodes';
import UserService from '../services/User.service';
import bcrypt from 'bcryptjs';
import { customAlphabet } from 'nanoid';
import prisma from '../config/prisma';
import { Prisma } from '@prisma/client';

export const generateShortCode = () => {
  const nanoid = customAlphabet('0123456789', 8); // chỉ 4 chữ số
  return `NAP${nanoid()}`; // Ví dụ: NAP4921
};
const userController = {
  createUser: async (req: Request, res: Response): Promise<void> => {
    try {
      const { role } = req.body;
      // if (role === 'admin') {
      //   errorResponse(
      //     res,
      //     'Role đã ngừng cung cấp, vui lòng chọn role khác',
      //     {},
      //     httpStatusCodes.BAD_REQUEST,
      //   );
      //   return;
      // }
      const userExists = await UserService.getUserByEmail(req.body.email);
      if (userExists) {
        errorResponse(res, 'Email đã tồn tại', {}, httpStatusCodes.CONFLICT);
        return;
      }
      let shortCode: string = '';
      let isUnique = false;
      while (!isUnique) {
        shortCode = generateShortCode();
        const existingUser = await UserService.getUserByShortCode(shortCode);
        if (!existingUser) isUnique = true;
      }
      const { password } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);
      req.body.password = hashedPassword;
      const user = await UserService.createUser({
        ...req.body,
        short_code: shortCode,
      });
      successResponse(res, 'Tạo người dùng thành công', user);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  getAllUsers: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId =
        typeof req.query.id === 'string' && req.query.id.trim()
          ? req.query.id.trim()
          : undefined;
      const query =
        typeof req.query.query === 'string' && req.query.query.trim()
          ? req.query.query.trim()
          : undefined;
      const pageNum = Math.max(1, Number(req.query.page) || 1);
      const pageSizeNum = Math.min(
        100,
        Math.max(1, Number(req.query.pageSize) || 10),
      ); // Giới hạn pageSize: 1-100
      const skip = (pageNum - 1) * pageSizeNum;

      const andConditions: Prisma.UserWhereInput[] = [];
      if (userId) {
        andConditions.push({ id: userId });
      }
      if (query) {
        andConditions.push({
          OR: [
            { username: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        });
      }

      const whereClause: Prisma.UserWhereInput =
        andConditions.length > 0 ? { AND: andConditions } : {};

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where: whereClause,
          orderBy: { created_at: 'desc' },
          skip,
          take: pageSizeNum,
        }),
        prisma.user.count({ where: whereClause }),
      ]);

      successResponse(res, 'Danh sách người dùng', {
        data: users,
        pagination: {
          total,
          page: pageNum,
          pageSize: pageSizeNum,
          totalPages: Math.ceil(total / pageSizeNum),
        },
      });
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },

  getUserById: async (req: Request, res: Response): Promise<void> => {
    try {
      const User = await UserService.getUserById(req.params.id);
      successResponse(res, 'Success', User);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },

  updateUser: async (req: Request, res: Response): Promise<void> => {
    try {
      const User = await UserService.getUserById(req.params.id);
      if (!User) {
        errorResponse(
          res,
          httpReasonCodes.NOT_FOUND,
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }

      const { password } = req.body;
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        req.body.password = hashedPassword;
      } else {
        delete req.body.password;
      }

      const UserNew = await UserService.updateUser(req.params.id, req.body);
      successResponse(res, 'Cập nhật người dùng thành công !', UserNew);
    } catch (error: any) {
      const statusCode = error.message.includes('not found') ? 404 : 400;
      if (statusCode === 404) {
        errorResponse(res, httpReasonCodes.NOT_FOUND, error, statusCode);
      } else {
        errorResponse(res, error?.message, error, statusCode);
      }
    }
  },

  deleteUser: async (req: Request, res: Response): Promise<void> => {
    try {
      const User = await UserService.getUserById(req.params.id);
      if (!User) {
        errorResponse(
          res,
          httpReasonCodes.NOT_FOUND,
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }
      await UserService.deleteUser(req.params.id);
      successResponse(res, 'Xóa người dùng thành công !', User);
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
export default userController;
