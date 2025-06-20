import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';

const prisma = new PrismaClient();

const voucherController = {
  async createVoucher(req: Request, res: Response): Promise<void> {
    const { code } = req.body;
    try {
      // Check code trùng
      const existing = await prisma.voucher.findUnique({ where: { code } });
      if (existing) {
        res.status(409).json({ error: 'Mã voucher đã tồn tại' });
        return;
      }
      const voucher = await prisma.voucher.create({
        data: req.body,
      });
      res.json(voucher);
    } catch (err) {
      res.status(400).json({ error: 'Tạo voucher bị lỗi', detail: err });
    }
  },

  async getAllVouchers(req: Request, res: Response) {
    try {
      const vouchers = await prisma.voucher.findMany();
      res.json(vouchers);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi lấy danh sách voucher' });
    }
  },

  async getVoucherById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const voucher = await prisma.voucher.findUnique({ where: { id } });
    if (!voucher) {
      res.status(404).json({ error: 'Không tìm thấy voucher' });
      return;
    }
    res.json(voucher);
  },

  async updateVoucher(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const voucher = await prisma.voucher.update({
        where: { id },
        data: req.body,
      });
      res.json(voucher);
    } catch (err) {
      res.status(400).json({ error: 'Cập nhật voucher thất bại', detail: err });
    }
  },

  async deleteVoucher(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await prisma.voucher.delete({ where: { id } });
      res.json({ message: 'Cập nhật voucher thành công' });
    } catch (err) {
      res.status(400).json({ error: 'Cập nhật voucher thất bại' });
    }
  },
};

export default voucherController;
