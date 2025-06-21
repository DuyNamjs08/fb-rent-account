import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpReasonCodes } from '../helpers/reasonPhrases';
import { httpStatusCodes } from '../helpers/statusCodes';
import UserService from '../services/User.service';
import bcrypt from 'bcryptjs';
import { customAlphabet } from 'nanoid';
import prisma from '../config/prisma';
import { Prisma } from '@prisma/client';
import { uploadToR2 } from '../middlewares/upload.middleware';
import { z } from 'zod';

export const generateShortCode = () => {
  const nanoid = customAlphabet('0123456789', 8); // chỉ 4 chữ số
  return `NAP${nanoid()}`; // Ví dụ: NAP4921
};
const updateUserSchema = z.object({
  email: z.string().email({ message: 'Email không hợp lệ' }).optional(),
  phone: z
    .string()
    .regex(/^\+?\d{9,15}$/, { message: 'Số điện thoại không hợp lệ' })
    .optional(),
  username: z.string().min(3, 'Username phải có ít nhất 3 ký tự').optional(),
  password: z.string().min(6, 'Password phải có ít nhất 6 ký tự').optional(),
  oldPassword: z
    .string()
    .min(6, 'Old password phải có ít nhất 6 ký tự')
    .optional(),
});
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
      const { email, phone, username, password, oldPassword } = req.body;
      const parsed = updateUserSchema.safeParse(req.body);
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
      const id = req.params.id;
      const User = await UserService.getUserById(id);
      if (!User) {
        errorResponse(
          res,
          httpReasonCodes.NOT_FOUND,
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }
      if (password && oldPassword) {
        const byHash = await bcrypt.compare(oldPassword, User.password);
        if (!byHash) {
          errorResponse(
            res,
            'Tài khoản hoặc mật khẩu không chính xác',
            {},
            httpStatusCodes.UNAUTHORIZED,
          );
          return;
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newpass = await prisma.user.update({
          where: {
            id,
          },
          data: {
            password: hashedPassword,
          },
        });
        successResponse(res, 'Cập nhật mật khẩu thành công !', newpass);
        return;
      }
      if (!email) {
        const updateActive = await prisma.user.update({
          where: {
            id,
          },
          data: {
            active: req.body.active,
          },
        });
        successResponse(res, 'Cập nhật người dùng thành công !', updateActive);
        return;
      }
      const findmail = await prisma.user.findUnique({
        where: {
          email,
        },
      });
      if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
        const payload = {
          email,
          phone,
          username,
        };

        if (User.email == email && findmail) {
          delete payload.email;
        } else if (findmail) {
          errorResponse(
            res,
            'Email đã tồn tại vui lòng chọn mail khác',
            {},
            httpStatusCodes.CONFLICT,
          );
          return;
        }
        const UserNew = await UserService.updateUser(id, payload);
        successResponse(res, 'Cập nhật người dùng thành công !', UserNew);
        return;
      }
      const allFiles = req.files as Express.Multer.File[];
      const images = allFiles.filter((file) =>
        file.mimetype.startsWith('image/'),
      );
      const uploadFiles = async (
        files: Express.Multer.File[],
        type: 'image' | 'video',
      ) => {
        return Promise.all(
          files.map(async (file) => {
            const timestamp = Date.now();
            const originalFilename = file.originalname.replace(/\s/g, '_');
            const newFilename = `${originalFilename}-${timestamp}`;
            const result = await uploadToR2(
              file.path,
              `user-uploads/${newFilename}`,
            );
            return {
              url: `${process.env.R2_PUBLIC_URL}/${result.Key}`,
              type, // 'image' hoặc 'video'
            };
          }),
        );
      };
      const [imageUploads] = await Promise.all([uploadFiles(images, 'image')]);
      const payload = { email, phone, username, images: imageUploads?.[0].url };
      if (User.email == email && findmail) {
        delete payload.email;
      } else if (findmail) {
        errorResponse(
          res,
          'Email đã tồn tại vui lòng chọn mail khác',
          {},
          httpStatusCodes.CONFLICT,
        );
        return;
      }
      const newUserImage = await UserService.updateUser(id, payload);
      successResponse(res, 'Cập nhật người dùng thành công !', newUserImage);
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
