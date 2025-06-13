import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpReasonCodes } from '../helpers/reasonPhrases';
import { httpStatusCodes } from '../helpers/statusCodes';
import prisma from '../config/prisma';
import { z } from 'zod';
const createBudgetSchema = z.object({
  name: z.string().min(1, 'Tên là bắt buộc'),
  description: z
    .array(z.string().min(1, 'Mỗi mô tả không được rỗng'))
    .min(1, 'Cần ít nhất một mô tả'),
  amount: z.number().nonnegative('Số tiền không thể âm'),
  start_date: z.string().min(1, 'Ngày bắt đầu là bắt buộc'),
  end_date: z.string().min(1, 'Ngày kết thúc là bắt buộc'),
  currency: z.string().min(1, 'Đơn vị tiền tệ là bắt buộc'),
  percentage: z.number(),
});
const getIdSchema = z.object({
  id: z.string().min(1, 'id là bắt buộc'),
});
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
      const parsed = createBudgetSchema.safeParse(req.body);
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
      const budget = await prisma.budget.create({
        data: {
          name,
          description,
          amount,
          start_date,
          end_date,
          currency,
          percentage,
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
      const parsed = getIdSchema.safeParse({ id });
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
      const parsed = createBudgetSchema.safeParse(req.body);
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
          percentage,
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
      const parsed = getIdSchema.safeParse({ id });
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
