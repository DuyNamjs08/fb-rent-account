import roleService from '../services/Roles.service';
import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpReasonCodes } from '../helpers/reasonPhrases';
import { httpStatusCodes } from '../helpers/statusCodes';
import UserService from '../services/User.service';
import prisma from '../config/prisma';
import { fbParnert } from '../workers/fb-partner';
const pointUsedController = {
  createPointUsed: async (req: Request, res: Response): Promise<void> => {
    try {
      const { bm_id, ads_account_id, user_id, amountPoint } = req.body;
      if (!bm_id || !ads_account_id || !user_id || !amountPoint) {
        errorResponse(
          res,
          'Vui lòng nhập đúng thông tin',
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
      if (!pointUsedController) {
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
      });
      successResponse(res, 'Đổi điểm thành công', poitsUsedTransaction);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },

  getAllRolesByUserId: async (req: Request, res: Response): Promise<void> => {
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

  deleteRole: async (req: Request, res: Response): Promise<void> => {
    try {
      const role = await roleService.getRoleById(req.params.id);
      if (!role) {
        errorResponse(res, httpReasonCodes.NOT_FOUND, {}, 404);
        return;
      }
      const users = await UserService.getUserByRoleId(req.params.id);
      await Promise.all(users.map((item) => UserService.deleteUser(item.id)));
      await roleService.deleteRole(req.params.id);
      successResponse(res, 'Xóa quyền thành công !', role);
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
