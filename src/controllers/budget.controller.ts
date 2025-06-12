import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpReasonCodes } from '../helpers/reasonPhrases';
import { httpStatusCodes } from '../helpers/statusCodes';
import prisma from '../config/prisma';
const budgetController = {
  createBudget: async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        name,
        description,
        amount,
        start_date,
        end_date,
        currency,
        percentage,
      } = req.body;
      if (
        !name ||
        !description ||
        !amount ||
        !start_date ||
        !end_date ||
        !currency ||
        !percentage
      ) {
        errorResponse(
          res,
          'Thiếu thông tin bắt buộc!',
          {},
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
      if (amount < 0) {
        errorResponse(
          res,
          'Số tiền không thể âm!',
          {},
          httpStatusCodes.INTERNAL_SERVER_ERROR,
        );
        return;
      }
      const budget = await prisma.budget.create({
        data: {
          name,
          description,
          amount,
          start_date,
          end_date,
          currency,
        },
      });
      successResponse(res, 'Tạo ngân sách thành công', budget);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },

  getAllBudgets: async (req: Request, res: Response): Promise<void> => {
    try {
      const budgets = await prisma.budget.findMany({
        orderBy: {
          created_at: 'desc',
        },
      });
      successResponse(res, 'Danh sách ngân sách', budgets);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },

  getbudgetById: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const budget = await prisma.budget.findUnique({
        where: { id },
      });
      if (!budget) {
        errorResponse(
          res,
          httpReasonCodes.NOT_FOUND,
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }

      successResponse(res, 'Success', budget);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },

  updatebudget: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        amount,
        start_date,
        end_date,
        currency,
        percentage,
      } = req.body;
      if (
        !name ||
        !description ||
        !amount ||
        !start_date ||
        !end_date ||
        !currency ||
        !percentage
      ) {
        errorResponse(
          res,
          'Thiếu thông tin bắt buộc!',
          {},
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
      if (amount < 0) {
        errorResponse(
          res,
          'Số tiền không thể âm!',
          {},
          httpStatusCodes.INTERNAL_SERVER_ERROR,
        );
        return;
      }
      const budgetExist = await prisma.budget.findUnique({
        where: { id },
      });
      if (!budgetExist) {
        errorResponse(
          res,
          httpReasonCodes.NOT_FOUND,
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }
      const budgetNew = await prisma.budget.update({
        where: { id },
        data: {
          name,
          description,
          amount,
          start_date,
          end_date,
          currency,
        },
      });

      successResponse(res, 'Cập nhật ngân sách thành công !', budgetNew);
    } catch (error: any) {
      const statusCode = error.message.includes('not found') ? 404 : 400;
      if (statusCode === 404) {
        errorResponse(res, httpReasonCodes.NOT_FOUND, error, statusCode);
      } else {
        errorResponse(res, error?.message, error, statusCode);
      }
    }
  },

  deletebudget: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const budgetExist = await prisma.budget.findUnique({
        where: { id },
      });
      if (!budgetExist) {
        errorResponse(
          res,
          httpReasonCodes.NOT_FOUND,
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }
      const budget = await prisma.budget.delete({
        where: { id },
      });
      successResponse(res, 'Xóa ngân sách thành công !', budget);
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

export default budgetController;
