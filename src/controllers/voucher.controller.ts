import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { errorResponse, successResponse } from '../helpers/response';
import { httpStatusCodes } from '../helpers/statusCodes';

const prisma = new PrismaClient();

const voucherController = {
  async createVoucher(req: Request, res: Response): Promise<void> {
    const { code } = req.body;
    try {
      // Check code trùng
      const existing = await prisma.voucher.findUnique({ where: { code } });
      if (existing) {
        errorResponse(
          res,
          req.t('voucher_code_exists'),
          {},
          httpStatusCodes.CONFLICT,
        );
        return;
      }
      const voucher = await prisma.voucher.create({
        data: req.body,
      });
      successResponse(res, req.t('voucher_created'), voucher);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },

  async getAllVouchers(req: Request, res: Response) {
    try {
      const vouchers = await prisma.voucher.findMany();
      successResponse(res, req.t('voucher_list_retrieved'), vouchers);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },

  async getVoucherById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const voucher = await prisma.voucher.findUnique({ where: { id } });
      if (!voucher) {
        errorResponse(
          res,
          req.t('voucher_not_found'),
          {},
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
      successResponse(res, req.t('voucher_info_retrieved'), voucher);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  async updateVoucher(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { code } = req.body;
      // Kiểm tra nếu mã code đã tồn tại ở voucher khác
      const duplicate = await prisma.voucher.findFirst({
        where: {
          code,
          NOT: { id },
        },
      });

      if (duplicate) {
        errorResponse(
          res,
          req.t('voucher_code_exists'),
          {},
          httpStatusCodes.CONFLICT,
        );
        return;
      }
      const voucher = await prisma.voucher.update({
        where: { id },
        data: req.body,
      });
      successResponse(res, req.t('voucher_updated'), voucher);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },

  async deleteVoucher(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await prisma.voucher.delete({ where: { id } });
      successResponse(res, req.t('voucher_deleted'), {});
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
};

export default voucherController;
