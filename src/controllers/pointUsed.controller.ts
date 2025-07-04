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
  bm_id: z.string().min(1, 'bm_id is required'),
  ads_account_id: z.string().min(1, 'ads_account_id is required'),
  user_id: z.string().min(1, 'user_id is required'),
  amountPoint: z.number().positive('please enter an amount greater than 0'),
  bm_origin: z.string().min(1, 'bm_origin is required'),
  ads_name: z.string().min(1, 'ads_name is required'),
  bot_id: z.string().min(1, 'bot_id is required'),
  currency: z.string().min(3, 'currency is required and min 3 character'),
});

const deleteChargeSchema = z.object({
  bm_id: z.string().min(1, 'bm_id is required'),
  ads_account_id: z.string().min(1, 'ads_account_id is required'),
  user_id: z.string().min(1, 'user_id is required'),
  id: z.string().min(1, 'id is required'),
  bm_origin: z.string().min(1, 'bm_origin is required'),
  ads_name: z.string().min(1, 'ads_name is required'),
  bot_id: z.string().min(1, 'bot_id is required'),
});
const getUserIdSchema = z.object({
  user_id: z.string().min(1, 'user_id is required'),
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
        currency,
      } = req.body;
      const parsed = createChargeSchema.safeParse(req.body);
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

      const user = await prisma.user.findUnique({
        where: { id: user_id },
        select: { points: true, percentage: true },
      });

      if (!user) {
        errorResponse(
          res,
          req.t('user_not_found'),
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }
      const amountOrigin = Math.floor(Number(amountPoint)); // số tiền trừ ở hệ thống

      const amountVNDchange =
        amountOrigin - amountOrigin * (user.percentage || 0.1); // số tiền chạy tkqc thật ở fb
      if (user.points < amountOrigin) {
        errorResponse(
          res,
          req.t('not_enough_points'),
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
            include: {
              voucher: true,
            },
          });
          if (!userVoucher || userVoucher.quantity <= 0) {
            errorResponse(
              res,
              req.t('voucher_invalid_or_used'),
              {},
              httpStatusCodes.BAD_REQUEST,
            );
            return;
          }
          if (
            userVoucher.voucher &&
            userVoucher.voucher.expires_at &&
            new Date() > new Date(userVoucher.voucher.expires_at)
          ) {
            errorResponse(
              res,
              req.t('voucher_expired'),
              {},
              httpStatusCodes.BAD_REQUEST,
            );
            return;
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
        if (currency == 'usd') {
          await tx.user.update({
            where: { id: user_id },
            data: {
              amount_usd: { decrement: amountOrigin },
            },
          });
        } else {
          await tx.user.update({
            where: { id: user_id },
            data: {
              points: { decrement: amountOrigin },
            },
          });
        }
        const pointsUsed = await tx.pointUsage.create({
          data: {
            user_id,
            points_used: amountOrigin,
            target_account: ads_account_id,
            description: 'Đổi điểm tài khoản quảng cáo',
            status: 'success',
            currency,
          },
        });
        return pointsUsed;
      });
      if (!poitsUsedTransaction) {
        errorResponse(
          res,
          req.t('point_exchange_error'),
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
          req.t('point_exchange_error'),
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
        currency,
      });
      console.log('✅ Job added to fbParnert queue:', job.id);

      successResponse(
        res,
        req.t('rent_account_in_progress'),
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

      successResponse(res, req.t('user_transaction_point_list'), {
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
          req.t('invalid_data'),
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
        errorResponse(res, req.t('user_not_found'), {}, 404);
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
      successResponse(res, req.t('user_transaction_point_list'), {
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
      const parsed = deleteChargeSchema.safeParse(req.query);
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
      const user = await prisma.user.findUnique({
        where: {
          id: user_id as string,
        },
      });
      if (!user) {
        errorResponse(res, req.t('user_not_found'), {}, 500);
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
      successResponse(res, req.t('remove_account_in_progress'), '');
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
