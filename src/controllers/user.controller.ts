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
import { v4 as uuidv4 } from 'uuid';
import { EmailService } from '../services/Email.service';
import jwt from 'jsonwebtoken';

import 'dotenv/config';

const FRONTEND_BASE_URL =
  process.env.VITE_URL_TEST || 'https://api.duynam.store';
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
      const { role, email } = req.body;
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
      // Tạo token xác thực (có thể dùng uuid hoặc JWT)
      const verificationToken = uuidv4();
      const tokenExpiresAt = new Date(Date.now() + 60 * 1000); // Token hết hạn sau 30s

      req.body.password = hashedPassword;
      const user = await UserService.createUser({
        ...req.body,
        is_verified: false,
        short_code: shortCode,
        verification_token: verificationToken,
        token_expires_at: tokenExpiresAt,
      });
      // Gửi email xác thực
      const verifyLink = `${FRONTEND_BASE_URL}/verify-notice?token=${verificationToken}`;
      await EmailService.sendVerificationEmail(email, verifyLink);
      console.log('4444444', verificationToken, tokenExpiresAt);
      successResponse(
        res,
        'Đăng ký thành công, vui lòng kiểm tra email để xác nhận.',
        null,
      );
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
  verifyEmail: async (req: Request, res: Response): Promise<void> => {
    try {
      const { token, cancel } = req.body;
      console.log('lalalalala777777', cancel, req.body, token);

      const user = await prisma.user.findFirst({
        where: {
          verification_token: token,
        },
      });
      // xóa user khi user từ chối xác thực
      if (cancel && user) {
        await prisma.user.delete({ where: { id: user.id } });
        successResponse(res, 'Đã thực hiện xóa user');
        return;
      }
      console.log('userrrrr1111', user);
      if (!user) {
        errorResponse(
          res,
          'Token không tồn tại hoặc người dùng không hợp lệ',
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }

      if (
        !user.token_expires_at ||
        new Date(user.token_expires_at) < new Date()
      ) {
        errorResponse(
          res,
          'Token đã hết hạn vui lòng xác thực lại',
          {},
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
      if (user) {
        await UserService.updateUser(user.id, {
          is_verified: true,
          verification_token: null,
          token_expires_at: null,
        });
        console.log('kakakakaka------1111');
        successResponse(res, 'Xác thực thành công');
      }
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  resendVerification: async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      console.log('email111', email);
      const user = await prisma.user.findUnique({ where: { email } });
      console.log('emaill2222', user);
      if (!user || user.is_verified) {
        errorResponse(res, 'Tài khoản không hợp lệ hoặc đã xác thực', {}, 400);
        return;
      }
      const newToken = uuidv4();
      const tokenExpiresAt = new Date(Date.now() + 60 * 1000); // 30s hoặc 24h
      await prisma.user.update({
        where: { email },
        data: {
          verification_token: newToken,
          token_expires_at: tokenExpiresAt,
        },
      });
      const verifyLink = `${FRONTEND_BASE_URL}/verify-notice?token=${newToken}`;
      await EmailService.sendVerificationEmail(user.email, verifyLink);
      successResponse(res, 'Đã gửi lại email xác thực!');
    } catch (err: any) {
      errorResponse(res, err.message, {}, 500);
    }
  },
};
export default userController;
