import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const userVoucherController = {
  // Gán voucher cho user
  async bulkToggleAssignVouchers(req: Request, res: Response): Promise<void> {
    try {
      const { user_id, voucher_states } = req.body;

      if (
        !user_id ||
        !Array.isArray(voucher_states) ||
        voucher_states.some(
          (v) => !v.voucher_id || typeof v.is_checked !== 'boolean',
        )
      ) {
        res.status(400).json({ error: 'Invalid payload' });
        return;
      }

      const allVoucherIds = voucher_states.map((v) => v.voucher_id);

      // Lấy danh sách voucher hiện tại user đã sở hữu
      const existing = await prisma.userVoucher.findMany({
        where: {
          user_id,
          voucher_id: { in: allVoucherIds },
        },
        select: { voucher_id: true },
      });

      const existingIds = new Set(existing.map((v) => v.voucher_id));

      const toCreate = voucher_states
        .filter((v) => v.is_checked && !existingIds.has(v.voucher_id))
        .map((v) => ({
          user_id,
          voucher_id: v.voucher_id,
        }));

      const toDelete = voucher_states
        .filter((v) => !v.is_checked && existingIds.has(v.voucher_id))
        .map((v) => v.voucher_id);

      // Tạo mới nếu có
      if (toCreate.length > 0) {
        await prisma.userVoucher.createMany({ data: toCreate });
      }

      // Xoá nếu có
      if (toDelete.length > 0) {
        await prisma.userVoucher.deleteMany({
          where: {
            user_id,
            voucher_id: { in: toDelete },
          },
        });
      }

      res.json({
        message: 'Cập nhật danh sách voucher thành công',
        assigned: toCreate.map((v) => v.voucher_id),
        unassigned: toDelete,
        unchanged: voucher_states
          .filter(
            (v) =>
              (v.is_checked && existingIds.has(v.voucher_id)) ||
              (!v.is_checked && !existingIds.has(v.voucher_id)),
          )
          .map((v) => v.voucher_id),
      });
    } catch (error: any) {
      console.error('Error syncing vouchers:', error);
      res
        .status(500)
        .json({ error: 'Cập nhật danh sách voucher thất bại', detail: error });
    }
  },
  // Lấy danh sách voucher của user hiện tại
  async getMyVouchers(req: Request, res: Response): Promise<void> {
    try {
      const user_id = req.query.user_id as string;
      if (!user_id) {
        res.status(400).json({ message: 'Missing user_id in query' });
        return;
      }
      const vouchers = await prisma.userVoucher.findMany({
        where: { user_id },
        include: { voucher: true },
      });
      res.json(vouchers);
    } catch (error) {
      console.error('Error fetching vouchers:', error);
      res.status(500).json({ message: 'Error fetching vouchers' });
    }
  },
  // Lấy danh sách tất cả voucher
  async getAllVouchers(req: Request, res: Response): Promise<void> {
    try {
      const { user_id } = req.params;

      // Lấy toàn bộ vouchers, bao gồm số lượt sử dụng
      const allVouchers = await prisma.voucher.findMany({
        include: {
          _count: {
            select: { userVouchers: true },
          },
        },
      });

      // Lấy danh sách voucher_id mà user đã sở hữu
      const assignedVouchers = await prisma.userVoucher.findMany({
        where: { user_id },
        select: { voucher_id: true },
      });

      const assignedIds = new Set(assignedVouchers.map((v) => v.voucher_id));
      const now = new Date();

      // Map lại kết quả gửi về cho FE
      const result = allVouchers.map((voucher) => {
        const isExpired = voucher.expires_at ? voucher.expires_at < now : false;
        let isExceeded = false;
        if (assignedIds.has(voucher.id)) {
          // Nếu user đang sở hữu voucher, isExceeded = false
          isExceeded = false;
        } else {
          // Nếu user không sở hữu voucher, kiểm tra max_usage
          isExceeded =
            voucher.max_usage !== null &&
            voucher._count.userVouchers >= voucher.max_usage;
        }
        return {
          ...voucher,
          is_checked: assignedIds.has(voucher.id),
          // due date
          is_expired: isExpired,
          // quá số lượng
          is_exceeded: isExceeded,
        };
      });

      res.json(result);
    } catch (error) {
      console.error('Error fetching vouchers:', error);
      res.status(500).json({ message: 'Error fetching vouchers' });
    }
  },
  async getAssignedUsers(req: Request, res: Response) {
    try {
      const { id: voucher_id } = req.params;

      const assignedUsers = await prisma.userVoucher.findMany({
        where: { voucher_id },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: {
          assigned_at: 'desc',
        },
      });

      const result = assignedUsers.map((item) => ({
        user_id: item.user.id,
        name: item.user.username,
        email: item.user.email,
        is_used: item.is_used,
        assigned_at: item.assigned_at,
      }));

      res.json(result);
    } catch (error) {
      console.error('Error fetching assigned users:', error);
      res.status(500).json({ message: 'Failed to fetch assigned users' });
    }
  },
  // Đánh dấu voucher là đã dùng
  async markVoucherAsUsed(req: Request, res: Response) {
    const { id } = req.params;
    console.log('idddddd', id);
    try {
      const updated = await prisma.userVoucher.update({
        where: { id },
        data: {
          is_used: true,
          used_at: new Date(),
        },
      });

      res.json({ message: 'Voucher marked as used', updated });
    } catch (error) {
      res
        .status(400)
        .json({ error: 'Failed to update voucher', detail: error });
    }
  },
};

export default userVoucherController;
