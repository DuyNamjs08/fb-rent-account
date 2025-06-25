import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpReasonCodes } from '../helpers/reasonPhrases';
import { httpStatusCodes } from '../helpers/statusCodes';
import prisma from '../config/prisma';
import { z } from 'zod';
const createBudgetSchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z
    .array(z.string().min(1, 'each description cannot be empty'))
    .min(1, 'at least one description is required'),
  amount: z.number().nonnegative('amount cannot be negative'),
  start_date: z.string().min(1, 'start date is required'),
  end_date: z.string().min(1, 'end date is required'),
  currency: z.string().min(1, 'currency is required'),
  percentage: z.number().optional(),
  subtitle: z.string().min(1, 'subtitle is required'),
  overview: z.string().min(1, 'overview is required'),
});
const getIdSchema = z.object({
  id: z.string().min(1, 'id is required'),
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
        subtitle,
        overview,
      } = req.body;
      const parsed = createBudgetSchema.safeParse(req.body);
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
      const budget = await prisma.budget.create({
        data: {
          name,
          description,
          amount,
          start_date,
          end_date,
          currency,
          percentage,
          subtitle,
          overview,
        },
      });
      successResponse(res, req.t('create_budget_success'), budget);
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
      const { lang } = req.query;
      const where = {
        country: lang === 'vi' ? 'vi' : { not: 'vi' },
      };

      const budgets = await prisma.budget.findMany({
        where,
        orderBy: {
          created_at: 'desc',
        },
      });
      successResponse(res, req.t('budget_list'), budgets);
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
          req.t('invalid_data'),
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
        subtitle,
        overview,
      } = req.body;
      const parsed = createBudgetSchema.safeParse(req.body);
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
          subtitle,
          overview,
        },
      });

      successResponse(res, req.t('update_budget_success'), budgetNew);
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
          req.t('invalid_data'),
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
      successResponse(res, req.t('delete_budget_success'), budget);
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
