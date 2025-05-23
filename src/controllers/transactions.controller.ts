import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpReasonCodes } from '../helpers/reasonPhrases';
import { httpStatusCodes } from '../helpers/statusCodes';
import prisma from '../config/prisma';
import redisClient from '../config/redis-config';
const transactionController = {
  createTransaction: async (req: Request, res: Response): Promise<void> => {
    const {
      short_code,
      amountVND,
      transactionID,
      description,
      bank,
      type,
      date,
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

  getAlltransactions: async (req: Request, res: Response): Promise<void> => {
    try {
      const transactions = await prisma.transaction.findMany({});
      successResponse(res, 'Danh sách quyền', transactions);
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
