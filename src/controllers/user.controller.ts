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
export const generateShortCodeInvite = () => {
  const nanoid = customAlphabet('0123456789', 8); // chỉ 4 chữ số
  return `AKA${nanoid()}`;
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
const createUserSchema = z.object({
  email: z.string().email({ message: 'Email không hợp lệ' }),
  phone: z
    .string()
    .regex(/^\+?\d{9,15}$/, { message: 'Số điện thoại không hợp lệ' }),
  username: z.string().min(3, 'Username phải có ít nhất 3 ký tự'),
  password: z.string().min(6, 'Password phải có ít nhất 6 ký tự'),
  code: z.string().min(11, 'Code is not valid ').optional(),
});
const transferSchema = z.object({
  fromId: z.string().uuid({ message: 'fromId phải là UUID hợp lệ' }),
  toId: z.string().uuid({ message: 'toId phải là UUID hợp lệ' }),
  amount: z
    .number({ invalid_type_error: 'amount phải là số' })
    .positive({ message: 'amount phải lớn hơn 0' }),
});
const ChangeAccountSchema = z.object({
  fromId: z.string().uuid({ message: 'fromId phải là UUID hợp lệ' }),
  toId: z.string().uuid({ message: 'toId phải là UUID hợp lệ' }),
  type: z.enum(['SUB', 'MAIN'], {
    required_error: 'Trường type là bắt buộc',
    invalid_type_error: 'Type chỉ được là SUB hoặc MAIN',
  }),
});
const userController = {
  createUser: async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, role, phone, username, code, password } = req.body;
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        const errors = parsed.error.flatten().fieldErrors;
        errorResponse(
          res,
          req.t('invalid_data'),
          errors,
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
      // if (role === 'admin') {
      //   errorResponse(
      //     res,
      //     'Role đã ngừng cung cấp, vui lòng chọn role khác',
      //     {},
      //     httpStatusCodes.BAD_REQUEST,
      //   );
      //   return;
      // }
      const userExists = await UserService.getUserByEmail(email);
      if (userExists) {
        errorResponse(
          res,
          req.t('email_already_exists'),
          {},
          httpStatusCodes.CONFLICT,
        );
        return;
      }
      let referralCode: string = '';
      let isUnique = false;
      while (!isUnique) {
        referralCode = generateShortCodeInvite();
        const existingUser =
          await UserService.getUserByReferralCode(referralCode);
        if (!existingUser) isUnique = true;
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      let inviteByUser = null;
      if (code) {
        inviteByUser = await prisma.user.findUnique({
          where: {
            referral_code: code,
          },
        });
      }
      if (inviteByUser) {
        const user = await prisma.user.create({
          data: {
            email,
            username,
            password: hashedPassword,
            phone,
            referral_code: referralCode,
            invited_by_id: inviteByUser.id,
            parent_id: inviteByUser.id,
            account_type: 'SUB',
          },
        });
        successResponse(res, req.t('user_created'), user);
        return;
      }
      const user = await prisma.user.create({
        data: {
          email,
          username,
          password: hashedPassword,
          phone,
          referral_code: referralCode,
          account_type: 'MAIN',
        },
      });
      successResponse(res, req.t('user_created'), user);
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

      successResponse(res, req.t('user_list'), {
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
      if (!req.params.id) {
        errorResponse(
          res,
          req.t('invalid_data'),
          {},
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
      const User = await prisma.user.findUnique({
        where: { id: req.params.id },
        include: {
          invitedBy: {
            select: {
              id: true,
              email: true,
              username: true,
              account_type: true,
              points: true,
            },
          },
          invitedUsers: {
            orderBy: {
              created_at: 'desc',
            },
            select: {
              id: true,
              email: true,
              username: true,
              account_type: true,
              points: true,
            },
          },
        },
      });
      successResponse(res, req.t('user_retrieved'), User);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  givePoints: async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = transferSchema.safeParse(req.body);
      if (!parsed.success) {
        const errors = parsed.error.flatten().fieldErrors;
        errorResponse(
          res,
          req.t('invalid_data'),
          errors,
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
      const { fromId, toId, amount } = parsed.data;
      const invitedChild = await prisma.user.findFirst({
        where: { id: toId, invited_by_id: fromId },
        select: { id: true },
      });
      if (!invitedChild) {
        errorResponse(
          res,
          req.t('not_invited_by_parent'),
          null,
          httpStatusCodes.FORBIDDEN,
        );
        return;
      }
      const fromUser = await prisma.user.findUnique({
        where: { id: fromId },
        select: { points: true },
      });

      if (!fromUser || fromUser.points < amount) {
        errorResponse(
          res,
          req.t('not_enough_points'),
          null,
          httpStatusCodes.FORBIDDEN,
        );
        return;
      }
      const transaction = await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: fromId },
          data: { points: { decrement: amount } },
        });
        await tx.user.update({
          where: { id: toId },
          data: { points: { increment: amount } },
        });
        const result = await tx.pointTransfer.create({
          data: { from_user_id: fromId, to_user_id: toId, amount },
        });
        return result;
      });

      successResponse(res, req.t('user_retrieved'), transaction);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  listgivePoints: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id;
      if (!id) {
        errorResponse(
          res,
          req.t('invalid_data'),
          {},
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
      const list = await prisma.pointTransfer.findMany({
        where: {
          from_user_id: id,
        },
        include: {
          fromUser: {
            select: {
              email: true,
              username: true,
            },
          },
          toUser: {
            select: {
              email: true,
              username: true,
              account_type: true,
            },
          },
        },
      });

      successResponse(res, req.t('user_retrieved'), list);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  listRetrievePoints: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id;
      if (!id) {
        errorResponse(
          res,
          req.t('invalid_data'),
          {},
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
      const list = await prisma.pointTransfer.findMany({
        where: {
          to_user_id: id,
        },
        include: {
          toUser: {
            select: {
              email: true,
              username: true,
            },
          },
          fromUser: {
            select: {
              email: true,
              username: true,
              account_type: true,
            },
          },
        },
      });

      successResponse(res, req.t('user_retrieved'), list);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  changeAccountType: async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = ChangeAccountSchema.safeParse(req.body);
      if (!parsed.success) {
        const errors = parsed.error.flatten().fieldErrors;
        errorResponse(
          res,
          req.t('invalid_data'),
          errors,
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
      const { fromId, toId, type } = parsed.data;
      const findUser = await prisma.user.findUnique({
        where: {
          id: toId,
          parent_id: fromId,
        },
      });
      if (!findUser) {
        errorResponse(
          res,
          req.t('user_not_found'),
          {},
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
      const updateUserType = await prisma.user.update({
        where: {
          id: toId,
          parent_id: fromId,
        },
        data: {
          account_type: type,
        },
      });
      successResponse(res, req.t('user_retrieved'), updateUserType);
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
          req.t('invalid_data'),
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
            req.t('incorrect_old_password'),
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
        successResponse(res, req.t('password_updated'), newpass);
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
        successResponse(res, req.t('user_updated'), updateActive);
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
            req.t('email_already_exists_choose_another'),
            {},
            httpStatusCodes.CONFLICT,
          );
          return;
        }
        const UserNew = await UserService.updateUser(id, payload);
        successResponse(res, req.t('user_updated'), UserNew);
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
          req.t('email_already_exists_choose_another'),
          {},
          httpStatusCodes.CONFLICT,
        );
        return;
      }
      const newUserImage = await UserService.updateUser(id, payload);
      successResponse(res, req.t('user_updated'), newUserImage);
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
      successResponse(res, req.t('user_deleted'), User);
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
