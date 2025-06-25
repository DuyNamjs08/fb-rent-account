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
          'Mã voucher đã tồn tại',
          {},
          httpStatusCodes.CONFLICT,
        );
        return;
      }
      const voucher = await prisma.voucher.create({
        data: req.body,
      });
      successResponse(res, 'Tạo voucher thành công', voucher);
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
      successResponse(res, 'Lấy danh sách voucher thành công', vouchers);
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
          'Không tìm thấy voucher',
          {},
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
      successResponse(res, 'Lấy thông tin voucher thành công', voucher);
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
          'Mã voucher đã tồn tại',
          {},
          httpStatusCodes.CONFLICT,
        );
        return;
      }
      const voucher = await prisma.voucher.update({
        where: { id },
        data: req.body,
      });
      successResponse(res, 'Cập nhật voucher thành công', voucher);
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
      successResponse(res, 'Xóa voucher thành công', {});
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
