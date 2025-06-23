import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpReasonCodes } from '../helpers/reasonPhrases';
import { httpStatusCodes } from '../helpers/statusCodes';
import prisma from '../config/prisma';
import { fbParnert } from '../workers/fb-partner';
import { fbRemoveParnert } from '../workers/fb-partner-remove';
import { createRepeatJob, fbCheckAccount } from '../workers/fb-check-account';
import { z } from 'zod';

const createChargeSchema = z.object({
  bm_id: z.string().min(1, 'bm_id là bắt buộc'),
  ads_account_id: z.string().min(1, 'ads_account_id là bắt buộc'),
  user_id: z.string().min(1, 'user_id là bắt buộc'),
  amountPoint: z.number().positive('Vui lòng nhập số tiền lớn hơn 0'),
  bm_origin: z.string().min(1, 'bm_origin là bắt buộc'),
  ads_name: z.string().min(1, 'ads_name là bắt buộc'),
  bot_id: z.string().min(1, 'bot_id là bắt buộc'),
});

const deleteChargeSchema = z.object({
  bm_id: z.string().min(1, 'bm_id là bắt buộc'),
  ads_account_id: z.string().min(1, 'ads_account_id là bắt buộc'),
  user_id: z.string().min(1, 'user_id là bắt buộc'),
  id: z.string().min(1, 'id là bắt buộc'),
  bm_origin: z.string().min(1, 'bm_origin là bắt buộc'),
  ads_name: z.string().min(1, 'ads_name là bắt buộc'),
  bot_id: z.string().min(1, 'bot_id là bắt buộc'),
});
const getUserIdSchema = z.object({
  user_id: z.string().min(1, 'user_id là bắt buộc'),
});
const pointUsedController = {
  checkSpending: async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        bm_id,
        ads_account_id,
        amountPoint,
        bm_origin,
        ads_name,
        bot_id,
        user_id,
      } = req.body;
      createRepeatJob({
        bm_id,
        ads_account_id,
        amountPoint,
        bm_origin,
        ads_name,
        bot_id,
        user_id,
      });
      successResponse(res, 'Checking spend', '');
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  createPointUsed: async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        bm_id,
        ads_account_id,
        user_id,
        amountPoint,
        bm_origin,
        ads_name,
        voucher_id,
        bot_id,
      } = req.body;
      const parsed = createChargeSchema.safeParse(req.body);
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

      const user = await prisma.user.findUnique({
        where: { id: user_id },
        select: { points: true, percentage: true },
      });

      if (!user) {
        errorResponse(
          res,
          'Không tìm thấy người dùng',
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }
      const amountOrigin = Math.floor(Number(amountPoint));
      const amountVNDchange =
        amountOrigin - amountOrigin * (user.percentage || 0.1);
      if (user.points < amountOrigin) {
        errorResponse(
          res,
          'Bạn không đủ điểm để thực hiện giao dịch',
          {},
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
      const poitsUsedTransaction = await prisma.$transaction(async (tx) => {
        if (voucher_id) {
          const userVoucher = await tx.userVoucher.findUnique({
            where: {
              user_id_voucher_id: {
                user_id,
                voucher_id,
              },
            },
          });
          if (!userVoucher || userVoucher.quantity <= 0) {
            throw new Error(
              'Bạn không có voucher này hoặc đã hết lượt sử dụng.',
            );
          }
          await tx.userVoucher.update({
            where: {
              user_id_voucher_id: {
                user_id,
                voucher_id,
              },
            },
            data: {
              quantity: {
                decrement: 1,
              },
            },
          });
          const updatedUserVoucher = await tx.userVoucher.findUnique({
            where: {
              user_id_voucher_id: {
                user_id,
                voucher_id,
              },
            },
          });
          // Nếu sau khi xóa SL voucher = 0 => xóa voucher
          if (updatedUserVoucher && updatedUserVoucher.quantity === 0) {
            await tx.userVoucher.delete({
              where: {
                user_id_voucher_id: {
                  user_id,
                  voucher_id,
                },
              },
            });
          }
        }
        const adsAccount = await tx.adsAccount.findFirst({
          where: {
            account_id: ads_account_id,
          },
        });
        if (!adsAccount) throw new Error('Tài khoản qc Không tồn tại!');
        await tx.user.update({
          where: { id: user_id },
          data: {
            points: { decrement: amountOrigin },
          },
        });
        const pointsUsed = await tx.pointUsage.create({
          data: {
            user_id,
            points_used: amountOrigin,
            target_account: ads_account_id,
            description: 'Đổi điểm tài khoản quảng cáo',
            status: 'success',
          },
        });
        return pointsUsed;
      });
      if (!poitsUsedTransaction) {
        errorResponse(
          res,
          'Lỗi đổi điểm vui lòng thử lại sau',
          {},
          httpStatusCodes.INTERNAL_SERVER_ERROR,
        );
        return;
      }

      const newBmPartnert = await prisma.facebookPartnerBM.create({
        data: {
          bm_id: bm_id as string,
          ads_account_id,
          user_id,
          status: 'process',
          status_partner: 0,
          status_limit_spend: 0,
          bm_origin,
          bot_id,
        },
      });
      if (!newBmPartnert) {
        errorResponse(
          res,
          'Lỗi đổi điểm vui lòng thử lại sau',
          {},
          httpStatusCodes.INTERNAL_SERVER_ERROR,
        );
        return;
      }
      const job = await fbParnert.add({
        bm_id,
        ads_account_id,
        user_id,
        amountPoint: amountVNDchange,
        amountOrigin,
        bm_origin,
        ads_name,
        bot_id,
        id_partner: newBmPartnert.id,
      });
      console.log('✅ Job added to fbParnert queue:', job.id);

      successResponse(
        res,
        'Quá trình thuê tài khoản đang điễn ra vui lòng đợi giây lát !!',
        poitsUsedTransaction,
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

  getAllpoints: async (req: Request, res: Response): Promise<void> => {
    try {
      const { pageSize = 10, page = 1, query = '' } = req.query;
      const skip = (Number(page) - 1) * Number(pageSize);
      const pageSizeNum = Number(pageSize) || 10;
      //
      const searchQuery = String(query || '');
      const stringFields = [
        'user_id',
        'service_type',
        'target_account',
        'description',
        'status',
      ];
      const numberFields = ['points_used'];
      const numericValue = Number(searchQuery);
      const isValidNumber = !Number.isNaN(numericValue);
      const whereCondition = {
        OR: [
          ...stringFields.map((field) => ({
            [field]: { contains: searchQuery, mode: 'insensitive' as const },
          })),
          ...(isValidNumber
            ? numberFields.map((field) => ({
                [field]: { equals: numericValue },
              }))
            : []),
        ],
      };
      const [transactionPoints, count] = await Promise.all([
        prisma.pointUsage.findMany({
          where: whereCondition,
          skip,
          take: pageSizeNum,
          orderBy: { created_at: 'desc' },
        }),
        prisma.pointUsage.count({ where: whereCondition }),
      ]);

      successResponse(res, 'Danh sách transaction points by user', {
        data: transactionPoints,
        count,
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
  getAllPointsByUserId: async (req: Request, res: Response): Promise<void> => {
    try {
      const { user_id, pageSize = 10, page = 1, query = '' } = req.query;
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
      const checkUser = await prisma.user.findUnique({
        where: {
          id: user_id as string,
        },
      });
      if (!checkUser) {
        errorResponse(res, 'User not found !!', {}, 404);
        return;
      }
      const skip = (Number(page) - 1) * Number(pageSize);
      const pageSizeNum = Number(pageSize) || 10;
      const searchQuery = String(query || '');
      const stringFields = [
        'user_id',
        'service_type',
        'target_account',
        'description',
        'status',
      ];
      const numberFields = ['points_used'];
      const numericValue = Number(searchQuery);
      const isValidNumber = !Number.isNaN(numericValue);
      const whereCondition = {
        OR: [
          ...stringFields.map((field) => ({
            [field]: { contains: searchQuery, mode: 'insensitive' as const },
          })),
          ...(isValidNumber
            ? numberFields.map((field) => ({
                [field]: { equals: numericValue },
              }))
            : []),
        ],
      };
      const [transactionPoints, count] = await Promise.all([
        prisma.pointUsage.findMany({
          where: whereCondition,
          skip,
          take: pageSizeNum,
          orderBy: { created_at: 'desc' },
        }),
        prisma.pointUsage.count({ where: whereCondition }),
      ]);
      successResponse(res, 'Danh sách transaction points by user', {
        data: transactionPoints,
        count,
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
  deleteUserUsedPoint: async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        bm_origin,
        bm_id,
        ads_account_id,
        user_id,
        ads_name,
        id,
        bot_id,
      } = req.query;
      const parsed = deleteChargeSchema.safeParse(req.body);
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
      const user = await prisma.user.findUnique({
        where: {
          id: user_id as string,
        },
      });
      if (!user) {
        errorResponse(res, 'Vui lòng cung cấp user_id', {}, 500);
        return;
      }
      await prisma.facebookPartnerBM.update({
        where: {
          id: id as string,
        },
        data: {
          status: 'process_remove',
          status_partner: 0,
          status_limit_spend: null,
          status_dischard_limit_spend: 1,
          status_dischard_partner: 1,
        },
      });
      await fbRemoveParnert.add({
        bm_id,
        ads_account_id,
        user_id,
        bm_origin,
        ads_name,
        bot_id,
        id,
      });
      successResponse(res, 'Quá trình gỡ tài khoản đang được xử lý!', '');
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

export default pointUsedController;
