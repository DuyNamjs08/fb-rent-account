import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpReasonCodes } from '../helpers/reasonPhrases';
import { httpStatusCodes } from '../helpers/statusCodes';
import prisma from '../config/prisma';
const policiesController = {
  createPolicies: async (req: Request, res: Response): Promise<void> => {
    try {
      const { title, message } = req.body;
      if (!title || !message) {
        errorResponse(
          res,
          'Vui lòng nhập đủ thông tin !',
          {},
          httpStatusCodes.INTERNAL_SERVER_ERROR,
        );
        return;
      }
      const policies = await prisma.policies.create({
        data: {
          title,
          message,
        },
      });
      successResponse(res, 'Tạo policies thành công', policies);
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
      const policiess = await prisma.policies.findMany({});
      successResponse(res, 'Danh policiess', policiess);
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
      if (!id) {
        errorResponse(
          res,
          'Vui lòng nhập đủ thông tin !',
          {},
          httpStatusCodes.INTERNAL_SERVER_ERROR,
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
      if (!title || !message || !id) {
        errorResponse(
          res,
          'Vui lòng nhập đủ thông tin !',
          {},
          httpStatusCodes.INTERNAL_SERVER_ERROR,
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
      successResponse(res, 'Cập nhật policies công !', policiesNew);
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
      if (!id) {
        errorResponse(
          res,
          'Vui lòng nhập đủ thông tin !',
          {},
          httpStatusCodes.INTERNAL_SERVER_ERROR,
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
      successResponse(res, 'Xóa policies thành công !', policies);
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
