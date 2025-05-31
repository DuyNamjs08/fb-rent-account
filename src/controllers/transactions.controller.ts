import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpReasonCodes } from '../helpers/reasonPhrases';
import { httpStatusCodes } from '../helpers/statusCodes';
import prisma from '../config/prisma';
import redisClient from '../config/redis-config';
import { generateShortCode } from './user.controller';
const transactionController = {
  createTransactionV2: async (req: Request, res: Response): Promise<void> => {
    const { amountVND, user_id } = req.body;
    if (
      !amountVND ||
      isNaN(Number(amountVND)) ||
      Number(amountVND) <= 0 ||
      !user_id
    ) {
      errorResponse(res, 'Vui lòng nhập đúng thông tin', {}, 404);
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
      successResponse(res, 'Tạo giao dịch thành công', transaction);
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
    if (
      !short_code ||
      !amountVND ||
      isNaN(Number(amountVND)) ||
      Number(amountVND) <= 0
    ) {
      errorResponse(res, 'Vui lòng nhập đúng thông tin', {}, 404);
      return;
    }
    const amountVNDchange = Math.floor(Number(amountVND));
    const canDeposit = await redisClient.incr(`deposit:lock:${short_code}`);
    if (canDeposit > 1) {
      errorResponse(res, 'Duplicate request', {}, 409);
      return;
    }
    try {
      const transactionExist = await prisma.$transaction(async (tx) => {
        const user = await tx.$queryRaw`
    SELECT * FROM "users"
    WHERE id = ${short_code}
    FOR UPDATE
  `;
        if (!user) throw new Error('User Không tồn tại!');
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
      successResponse(res, 'Giao dịch thành công', transactionExist);
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

  getAlltransactionsByUserId: async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const { user_id, pageSize = 10, page = 1 } = req.query;
      if (!user_id) {
        errorResponse(res, 'Vui lòng cung cấp user_id', {}, 500);
        return;
      }
      const checkUser = await prisma.user.findUnique({
        where: {
          id: user_id as string,
        },
      });
      if (!checkUser) {
        errorResponse(res, 'User not found !', {}, 404);
        return;
      }
      const skip = (Number(page) - 1) * Number(pageSize);
      const pageSizeNum = Number(pageSize) || 10;
      const transactions = await prisma.transaction.findMany({
        where: {
          user_id: user_id as string,
        },
        skip,
        take: pageSizeNum,
      });
      successResponse(res, 'Danh sách transaction by user', transactions);
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
      const transaction = await prisma.transaction.findFirst({
        where: {
          id,
        },
      });
      successResponse(res, 'Success', transaction);
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
      const transaction = await prisma.transaction.findFirst({
        where: {
          id,
        },
      });
      if (!transaction) {
        errorResponse(res, httpReasonCodes.NOT_FOUND, {}, 404);
        return;
      }
      await prisma.transaction.delete({
        where: {
          id,
        },
      });
      successResponse(res, 'Xóa giao dịch thành công !', transaction);
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

export default transactionController;
