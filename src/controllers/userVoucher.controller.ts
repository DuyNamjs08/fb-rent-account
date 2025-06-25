import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { errorResponse, successResponse } from '../helpers/response';
import { httpStatusCodes } from '../helpers/statusCodes';

const prisma = new PrismaClient();

const userVoucherController = {
  // Helper: Xóa userVoucher quá hạn 48h (chưa dùng)
  async removeExpiredUserVouchers() {
    const now = new Date();
    await prisma.userVoucher.deleteMany({
      where: {
        assigned_at: {
          lt: new Date(now.getTime() - 48 * 60 * 60 * 1000), // 48h trước
        },
        // is_used: false,
      },
    });
  },
  // Gán voucher cho user
  async bulkToggleAssignVouchers(req: Request, res: Response): Promise<void> {
    try {
      await userVoucherController.removeExpiredUserVouchers();
      const { user_id, voucher_states } = req.body;

      if (
        !user_id ||
        !Array.isArray(voucher_states) ||
        voucher_states.some(
          (v) =>
            !v.voucher_id ||
            typeof v.is_checked !== 'boolean' ||
            (v.is_checked &&
              (typeof v.quantity !== 'number' || v.quantity < 0)),
        )
      ) {
        errorResponse(
          res,
          req.t('invalid_data'),
          {},
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }

      for (const state of voucher_states) {
        const { voucher_id, is_checked, quantity } = state;

        if (!is_checked || quantity === 0) {
          // Xoá nếu is_checked=false hoặc quantity=0
          await prisma.userVoucher.deleteMany({
            where: {
              user_id,
              voucher_id,
            },
          });
          continue;
        }

        // Lấy thông tin voucher và tổng số lượng đã gán
        const voucher = await prisma.voucher.findUnique({
          where: { id: voucher_id },
          include: { _count: { select: { userVouchers: true } } },
        });

        if (!voucher) {
          // IGNORE: không tìm thấy voucher thì bỏ qua
          continue;
        }

        // Lấy thông tin userVoucher hiện tại
        const existingUserVoucher = await prisma.userVoucher.findUnique({
          where: {
            user_id_voucher_id: {
              user_id,
              voucher_id,
            },
          },
          select: { quantity: true },
        });

        // Tính toán tổng số lượng đã cấp phát
        let totalAssigned = 0;
        if (voucher.max_usage) {
          const allUserVouchers = await prisma.userVoucher.findMany({
            where: { voucher_id },
            select: { quantity: true },
          });
          totalAssigned = allUserVouchers.reduce(
            (sum, uv) => sum + uv.quantity,
            0,
          );
        }

        // Nếu đã tồn tại, số lượng hiện tại không được tính vào tổng
        const currentQuantity = existingUserVoucher
          ? existingUserVoucher.quantity
          : 0;
        const availableQuantity = voucher.max_usage
          ? voucher.max_usage - (totalAssigned - currentQuantity)
          : Infinity;

        if (quantity > availableQuantity) {
          errorResponse(
            res,
            req.t('voucher_quantity_exceeded', {
              voucherName: voucher.name,
              availableQuantity,
            }),
            {},
            httpStatusCodes.BAD_REQUEST,
          );
          return;
        }

        // Tạo hoặc cập nhật
        await prisma.userVoucher.upsert({
          where: {
            user_id_voucher_id: {
              user_id,
              voucher_id,
            },
          },
          update: { quantity },
          create: {
            user_id,
            voucher_id,
            quantity,
          },
        });
      }
      successResponse(res, req.t('voucher_list_updated'), {});
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  // Lấy danh sách voucher của user hiện tại
  async getMyVouchers(req: Request, res: Response): Promise<void> {
    try {
      await userVoucherController.removeExpiredUserVouchers();
      const user_id = req.query.user_id as string;
      if (!user_id) {
        errorResponse(
          res,
          req.t('missing_user_id'),
          {},
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
      const vouchers = await prisma.userVoucher.findMany({
        where: { user_id },
        include: { voucher: true },
      });
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
  // Lấy danh sách tất cả voucher
  async getAllVouchers(req: Request, res: Response): Promise<void> {
    try {
      await userVoucherController.removeExpiredUserVouchers();
      const { user_id } = req.params;

      // Lấy toàn bộ vouchers
      const allVouchers = await prisma.voucher.findMany({
        include: {
          userVouchers: true, // Lấy tất cả userVouchers để tính tổng số lượng
        },
      });

      // Lấy danh sách userVoucher của user hiện tại
      const assignedUserVouchers = await prisma.userVoucher.findMany({
        where: { user_id },
        select: { voucher_id: true, quantity: true },
      });

      // Tạo map để dễ tra cứu
      const assignedMap = new Map(
        assignedUserVouchers.map((uv) => [uv.voucher_id, uv.quantity]),
      );

      const now = new Date();

      // Map lại kết quả gửi về cho FE
      const result = allVouchers.map((voucher) => {
        const totalAssignedQuantity = voucher.userVouchers.reduce(
          (sum, uv) => sum + uv.quantity,
          0,
        );
        const isExpired = voucher.expires_at ? voucher.expires_at < now : false;
        const isChecked = assignedMap.has(voucher.id);
        const quantity = isChecked ? assignedMap.get(voucher.id) : 0; // Mặc định là 0 nếu chưa có

        let isExceeded = false;
        if (!isChecked) {
          isExceeded =
            voucher.max_usage !== null &&
            totalAssignedQuantity >= voucher.max_usage;
        }

        return {
          ...voucher,
          is_checked: isChecked,
          quantity,
          is_expired: isExpired,
          is_exceeded: isExceeded,
          total_assigned: totalAssignedQuantity, // số lượng đã gán cho tất cả user
        };
      });
      successResponse(res, req.t('voucher_list_retrieved'), result);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  // async getAssignedUsers(req: Request, res: Response) {
  //   try {
  //     const { id: voucher_id } = req.params;

  //     const assignedUsers = await prisma.userVoucher.findMany({
  //       where: { voucher_id },
  //       select: {
  //         id: true,
  //         user_id: true,
  //         voucher_id: true,
  //         is_used: true,
  //         assigned_at: true,
  //         used_at: true,
  //         quantity: true,
  //         user: {
  //           select: {
  //             id: true,
  //             username: true,
  //             email: true,
  //             role: true,
  //           },
  //         },
  //       },
  //       orderBy: {
  //         assigned_at: 'desc',
  //       },
  //     });

  //     const result = assignedUsers.map((item) => ({
  //       user_id: item.user.id,
  //       name: item.user.username,
  //       email: item.user.email,
  //       is_used: item.is_used,
  //       quantity: item.quantity,
  //       assigned_at: item.assigned_at,
  //     }));

  //     successResponse(
  //       res,
  //       'Lấy danh sách user thuộc voucher thành công',
  //       result,
  //     );
  //   } catch (error: any) {
  //     errorResponse(
  //       res,
  //       error?.message,
  //       error,
  //       httpStatusCodes.INTERNAL_SERVER_ERROR,
  //     );
  //   }
  // },
};

export default userVoucherController;
