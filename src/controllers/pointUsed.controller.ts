import roleService from '../services/Roles.service';
import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpReasonCodes } from '../helpers/reasonPhrases';
import { httpStatusCodes } from '../helpers/statusCodes';
import prisma from '../config/prisma';
import { fbParnert } from '../workers/fb-partner';
import { fbRemoveParnert } from '../workers/fb-partner-remove';
const pointUsedController = {
  createPointUsed: async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        bm_id,
        ads_account_id,
        user_id,
        amountPoint,
        bm_origin,
        ads_name,
        bot_id,
      } = req.body;
      if (
        !bm_id ||
        !ads_account_id ||
        !user_id ||
        !amountPoint ||
        !bm_origin ||
        !ads_name ||
        !bot_id
      ) {
        errorResponse(
          res,
          'Vui lòng nhập đủ thông tin',
          {},
          httpStatusCodes.INTERNAL_SERVER_ERROR,
        );
        return;
      }
      const amountVNDchange = Math.floor(Number(amountPoint));
      const user = await prisma.user.findUnique({
        where: { id: user_id },
        select: { points: true },
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

      if (user.points < amountVNDchange) {
        errorResponse(
          res,
          'Bạn không đủ điểm để thực hiện giao dịch',
          {},
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
      const poitsUsedTransaction = await prisma.$transaction(async (tx) => {
        const adsAccount = await tx.adsAccount.findFirst({
          where: {
            account_id: ads_account_id,
          },
        });
        if (!adsAccount) throw new Error('Tài khoản qc Không tồn tại!');
        await tx.user.update({
          where: { id: user_id },
          data: {
            points: { decrement: amountVNDchange },
          },
        });
        const pointsUsed = await tx.pointUsage.create({
          data: {
            user_id,
            points_used: amountVNDchange,
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
      await fbParnert.add({
        bm_id,
        ads_account_id,
        user_id,
        amountPoint,
        bm_origin,
        ads_name,
        bot_id,
      });
      successResponse(
        res,
        'Thuê tài khoản thành công!!',
        'poitsUsedTransaction',
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
      const { pageSize = 10, page = 1 } = req.query;
      const skip = (Number(page) - 1) * Number(pageSize);
      const pageSizeNum = Number(pageSize) || 10;
      const transactionPoints = await prisma.pointUsage.findMany({
        where: {},
        skip,
        take: pageSizeNum,
      });
      const count = await prisma.pointUsage.count({
        where: {},
        skip,
        take: pageSizeNum,
      });
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
        errorResponse(res, 'User not found !!', {}, 404);
        return;
      }
      const skip = (Number(page) - 1) * Number(pageSize);
      const pageSizeNum = Number(pageSize) || 10;
      const transactionPoints = await prisma.pointUsage.findMany({
        where: {
          user_id: user_id as string,
        },
        skip,
        take: pageSizeNum,
      });
      const count = await prisma.pointUsage.count({
        where: {
          user_id: user_id as string,
        },
        skip,
        take: pageSizeNum,
      });
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
      if (
        !bm_id ||
        !ads_account_id ||
        !user_id ||
        !bm_origin ||
        !ads_name ||
        !id ||
        !bot_id
      ) {
        errorResponse(
          res,
          'Vui lòng nhập đúng thông tin',
          {},
          httpStatusCodes.INTERNAL_SERVER_ERROR,
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
      const filterUser = user.list_ads_account.filter(
        (item) => item !== ads_account_id,
      );
      await prisma.user.update({
        where: {
          id: user_id as string,
        },
        data: {
          list_ads_account: filterUser,
        },
      });
      await prisma.facebookPartnerBM.update({
        where: {
          id: id as string,
        },
        data: {
          status: 'dischard',
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
      });
      successResponse(res, 'Gỡ khỏi tài khoản quảng cáo thành công !', '');
    } catch (error: any) {
      const statusCode = error.message.includes('not found') ? 404 : 400;
      if (statusCode === 404) {
        errorResponse(res, httpReasonCodes.NOT_FOUND, error, statusCode);
      } else {
        errorResponse(res, error?.message, error, statusCode);
      }
    }
  },

  getRoleById: async (req: Request, res: Response): Promise<void> => {
    try {
      const role = await roleService.getRoleById(req.params.id);
      successResponse(res, 'Success', role);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },

  updateRole: async (req: Request, res: Response): Promise<void> => {
    try {
      const role = await roleService.getRoleById(req.params.id);
      if (!role) {
        errorResponse(
          res,
          httpReasonCodes.NOT_FOUND,
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }
      const roleNew = await roleService.updateRole(req.params.id, req.body);
      successResponse(res, 'Cập nhật quyền thành công !', roleNew);
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
