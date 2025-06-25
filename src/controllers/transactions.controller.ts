import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpReasonCodes } from '../helpers/reasonPhrases';
import { httpStatusCodes } from '../helpers/statusCodes';
import prisma from '../config/prisma';
import redisClient from '../config/redis-config';
import { generateShortCode } from './user.controller';
import { z } from 'zod';

const rechargeSchema = z.object({
  amountVND: z.preprocess(
    (val) => Number(val),
    z.number().positive('Số tiền phải lớn hơn 0'),
  ),
  user_id: z.string().min(1, 'user_id is required'),
});
const rechargeIdSchema = z.object({
  id: z.string().min(1, 'id is required'),
});

const transactionController = {
  createTransactionV2: async (req: Request, res: Response): Promise<void> => {
    const { amountVND, user_id } = req.body;
    const parsed = rechargeSchema.safeParse(req.body);
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
    let shortCode: string = '';
    let isUnique = false;
    while (!isUnique) {
      shortCode = generateShortCode();
      const existingUser = await prisma.transaction.findUnique({
        where: { short_code: shortCode },
      });
      if (!existingUser) isUnique = true;
    }
    const amountVNDchange = Math.floor(Number(amountVND));
    const transaction = await prisma.transaction.create({
      data: {
        short_code: shortCode,
        amountVND: amountVNDchange,
        points: amountVNDchange,
        transactionID: 0,
        description: '',
        bank: '',
        type: '',
        date: '',
        status: 'pending',
        user_id,
      },
    });
    try {
      successResponse(res, req.t('transaction_created'), transaction);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  createTransaction: async (req: Request, res: Response): Promise<void> => {
    const {
      short_code,
      amountVND,
      transactionID,
      description,
      bank,
      type,
      date,
      user_id,
    } = req.body;
    const parsed = rechargeSchema.safeParse(req.body);
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
    const amountVNDchange = Math.floor(Number(amountVND));
    const canDeposit = await redisClient.incr(`deposit:lock:${short_code}`);
    if (canDeposit > 1) {
      errorResponse(res, req.t('duplicate_request'), {}, 409);
      return;
    }
    try {
      const transactionExist = await prisma.$transaction(async (tx) => {
        const user = await tx.$queryRaw`
    SELECT * FROM "users"
    WHERE id = ${short_code}
    FOR UPDATE
  `;
        if (!user) throw new Error(req.t('user_not_found'));
        await tx.user.update({
          where: { id: short_code },
          data: {
            points: { increment: amountVNDchange },
          },
        });
        const transaction = await tx.transaction.create({
          data: {
            short_code,
            amountVND: amountVNDchange,
            points: amountVNDchange,
            transactionID,
            description,
            bank,
            type,
            date,
            user_id,
          },
        });
        return transaction;
      });
      await redisClient.set(
        `user:points:${short_code}`,
        amountVNDchange,
        'EX',
        60,
      );
      await redisClient.del(`deposit:lock:${short_code}`);
      successResponse(res, req.t('transaction_success'), transactionExist);
    } catch (error: any) {
      await redisClient.del(`deposit:lock:${short_code}`);
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },

  getAlltransactions: async (req: Request, res: Response): Promise<void> => {
    try {
      const { pageSize = 10, page = 1, query = '' } = req.query;
      const skip = (Number(page) - 1) * Number(pageSize);
      const pageSizeNum = Number(pageSize) || 10;
      const searchQuery = String(query || '');

      const stringFields = [
        'short_code',
        'user_id',
        'bank',
        'description',
        'type',
        'date',
        'status',
        'error_message',
      ];
      const numberFields = ['transactionID', 'points', 'amountVND'];
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

      const [transactions, count] = await Promise.all([
        prisma.transaction.findMany({
          where: whereCondition,
          skip,
          take: pageSizeNum,
          orderBy: { created_at: 'desc' },
          include: {
            user: {
              select: {
                username: true,
                email: true,
                phone: true,
              },
            },
          },
        }),
        prisma.transaction.count({ where: whereCondition }),
      ]);

      successResponse(res, req.t('transaction_list_by_user'), {
        data: transactions,
        count,
        totalPages: Math.ceil(count / pageSizeNum),
        currentPage: Number(page),
        pageSize: pageSizeNum,
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
  getAlltransactionsByUserId: async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const { user_id, pageSize = 10, page = 1, query = '' } = req.query;
      if (!user_id) {
        errorResponse(res, req.t('provide_user_id'), {}, 500);
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
        'short_code',
        'user_id',
        'bank',
        'description',
        'type',
        'date',
        'status',
        'error_message',
      ];
      const numberFields = ['transactionID', 'points', 'amountVND'];
      const numericValue = Number(searchQuery);
      const isValidNumber = !Number.isNaN(numericValue);
      const whereCondition = {
        AND: [
          { user_id: user_id as string },
          {
            OR: [
              ...stringFields.map((field) => ({
                [field]: {
                  contains: searchQuery,
                  mode: 'insensitive' as const,
                },
              })),
              ...(isValidNumber
                ? numberFields.map((field) => ({
                    [field]: { equals: numericValue },
                  }))
                : []),
            ],
          },
        ],
      };
      const [transactions, count] = await Promise.all([
        prisma.transaction.findMany({
          where: whereCondition,
          skip,
          take: pageSizeNum,
          orderBy: { created_at: 'desc' },
          include: {
            user: {
              select: {
                username: true,
                email: true,
                phone: true,
              },
            },
          },
        }),
        prisma.transaction.count({ where: whereCondition }),
      ]);
      successResponse(res, req.t('transaction_list_by_user'), {
        data: transactions,
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

  gettransactionById: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const parsed = rechargeIdSchema.safeParse({ id });
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
      const transaction = await prisma.transaction.findFirst({
        where: {
          id,
        },
      });
      successResponse(res, req.t('transaction_retrieved'), transaction);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },

  deletetransaction: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const parsed = rechargeIdSchema.safeParse({ id });
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
      const transaction = await prisma.transaction.findFirst({
        where: {
          id,
        },
      });
      if (!transaction) {
        errorResponse(res, req.t('not_found'), {}, 404);
        return;
      }
      await prisma.transaction.delete({
        where: {
          id,
        },
      });
      successResponse(res, req.t('transaction_deleted'), transaction);
    } catch (error: any) {
      const statusCode = error.message.includes('not found') ? 404 : 400;
      if (statusCode === 404) {
        errorResponse(res, req.t('not_found'), error, statusCode);
      } else {
        errorResponse(res, error?.message, error, statusCode);
      }
    }
  },
};

export default transactionController;
