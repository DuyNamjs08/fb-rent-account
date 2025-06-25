import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpReasonCodes } from '../helpers/reasonPhrases';
import { httpStatusCodes } from '../helpers/statusCodes';
import prisma from '../config/prisma';
import { z } from 'zod';

const createMessageSchema = z.object({
  title: z.string().min(1, 'title is required'),
  message: z.string().min(1, 'content is required'),
});

const updateMessageSchema = z.object({
  id: z.string().min(1, 'id is required'),
  title: z.string().min(1, 'title is required'),
  message: z.string().min(1, 'content is required'),
});
const getIdSchema = z.object({
  id: z.string().min(1, 'id is required'),
});
const policiesController = {
  createPolicies: async (req: Request, res: Response): Promise<void> => {
    try {
      const { title, message } = req.body;
      const parsed = createMessageSchema.safeParse(req.body);
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
      const policies = await prisma.policies.create({
        data: {
          title,
          message,
        },
      });
      successResponse(res, req.t('create_policy_success'), policies);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },

  getAllpoliciess: async (req: Request, res: Response): Promise<void> => {
    try {
      const policiess = await prisma.policies.findMany({
        orderBy: { created_at: 'desc' },
      });
      successResponse(res, req.t('policy_list'), policiess);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },

  getPoliciesById: async (req: Request, res: Response): Promise<void> => {
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
      const policies = await prisma.policies.findUnique({
        where: {
          id,
        },
      });
      successResponse(res, 'Success', policies);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },

  updatePolicies: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { title, message } = req.body;
      const parsed = updateMessageSchema.safeParse({ ...req.body, id });
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
      const policiesNew = await await prisma.policies.update({
        where: {
          id,
        },
        data: {
          title,
          message,
        },
      });
      successResponse(res, req.t('update_policy_success'), policiesNew);
    } catch (error: any) {
      const statusCode = error.message.includes('not found') ? 404 : 400;
      if (statusCode === 404) {
        errorResponse(res, httpReasonCodes.NOT_FOUND, error, statusCode);
      } else {
        errorResponse(res, error?.message, error, statusCode);
      }
    }
  },

  deletePolicies: async (req: Request, res: Response): Promise<void> => {
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
      const policies = await prisma.policies.findUnique({
        where: {
          id,
        },
      });
      await prisma.policies.delete({
        where: {
          id,
        },
      });
      successResponse(res, req.t('delete_policy_success'), policies);
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

export default policiesController;
