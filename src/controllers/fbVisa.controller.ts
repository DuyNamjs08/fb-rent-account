import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpReasonCodes } from '../helpers/reasonPhrases';
import { httpStatusCodes } from '../helpers/statusCodes';
import prisma from '../config/prisma';
import { z } from 'zod';
import { fbParnertVisa } from '../workers/fb-partner-visa';
import {
  createRepeatJobVisa,
  fbCheckAccountVisa,
} from '../workers/fb-check-visa';
import { addDays } from 'date-fns';
export const FacebookVisaSchema = z.object({
  id: z.string().uuid().optional(),
  visa_name: z
    .string()
    .min(6, 'visa_name must be at least 6 characters long')
    .max(50, 'visa_name too long')
    .regex(
      /^[A-Z\s]+$/,
      'visa_name must contain only uppercase letters and spaces',
    ),
  visa_number: z.string().regex(/^\d{16}$/, 'visa_number must be 16 digits'),
  visa_expiration: z
    .string()
    .regex(
      /^(0[1-9]|1[0-2])\/\d{2}$/,
      'visa_expiration must be in MM/YY format',
    ),
  visa_cvv: z.string().regex(/^\d{3,4}$/, 'visa_cvv must be 3 or 4 digits'),
  verify_code: z.string().min(1, 'verify_code is required'),
  bm_name: z.string().min(1, 'bm_name is required'),
  bm_origin: z.string().min(1, 'bm_origin is required'),
  ads_account_id: z.string().min(1, 'ads_account_id is required'),
  user_id: z.string().min(1, 'user_id is required'),
});
const createChargeSchema = z.object({
  visa_name: z
    .string()
    .min(6, 'visa_name must be at least 6 characters long')
    .max(50, 'visa_name too long')
    .regex(
      /^[A-Z\s]+$/,
      'visa_name must contain only uppercase letters and spaces',
    ),
  visa_number: z.string().regex(/^\d{16}$/, 'visa_number must be 16 digits'),
  visa_expiration: z
    .string()
    .regex(
      /^(0[1-9]|1[0-2])\/\d{2}$/,
      'visa_expiration must be in MM/YY format',
    ),
  visa_cvv: z.string().regex(/^\d{3,4}$/, 'visa_cvv must be 3 or 4 digits'),
  verify_code: z.string().min(1, 'verify_code is required'),
  //phần visa
  bm_id: z.string().min(1, 'bm_id là bắt buộc'),
  ads_account_id: z.string().min(1, 'ads_account_id là bắt buộc'),
  user_id: z.string().min(1, 'user_id là bắt buộc'),
  amountPoint: z.number().positive('Vui lòng nhập số tiền lớn hơn 0'),
  bm_origin: z.string().min(1, 'bm_origin là bắt buộc'),
  ads_name: z.string().min(1, 'ads_name là bắt buộc'),
  bot_id: z.string().min(1, 'bot_id là bắt buộc'),
  voucher_id: z.string().optional(),
});
const visaController = {
  createAndUpadateVisa: async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        id,
        visa_name,
        visa_number,
        visa_expiration,
        visa_cvv,
        verify_code,
        bm_name,
        bm_origin,
        ads_account_id,
        user_id,
      } = req.body;
      const parsed = FacebookVisaSchema.safeParse(req.body);
      if (!parsed.success) {
        const errors = parsed.error.flatten().fieldErrors;
        errorResponse(
          res,
          'Dữ liệu không hợp lệ',
          errors,
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
      let visa = null;
      if (id) {
        const existingVisa = await prisma.facebookVisa.findUnique({
          where: { id },
        });
        if (!existingVisa) {
          errorResponse(
            res,
            'Visa không tồn tại',
            httpReasonCodes.NOT_FOUND,
            httpStatusCodes.NOT_FOUND,
          );
          return;
        }
        // Cập nhật visa nếu đã tồn tại
        visa = await prisma.facebookVisa.update({
          where: { id },
          data: {
            visa_name,
            visa_number,
            visa_expiration,
            visa_cvv,
            verify_code,
            bm_name,
            bm_origin,
            ads_account_id,
            user_id,
          },
        });
        successResponse(res, 'Cập nhật visa thành công', visa);
        return;
      }
      visa = await prisma.facebookVisa.create({
        data: {
          id,
          visa_name,
          visa_number,
          visa_expiration,
          visa_cvv,
          verify_code,
          bm_name,
          bm_origin,
          ads_account_id,
          user_id,
        },
      });
      successResponse(res, 'Tạo visa thành công', visa);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  createPointUsedVisa: async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        bm_id,
        ads_account_id,
        user_id,
        amountPoint,
        voucher_id,
        bm_origin,
        ads_name,
        bot_id,
        //  phần visa
        visa_name,
        visa_number,
        visa_expiration,
        visa_cvv,
        verify_code,
      } = req.body;
      const parsed = createChargeSchema.safeParse(req.body);
      if (!parsed.success) {
        const errors = parsed.error.flatten().fieldErrors;
        errorResponse(
          res,
          'Dữ liệu không hợp lệ',
          errors,
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
      const amountVNDchange = Math.floor(Number(amountPoint));

      const poitsUsedTransaction = await prisma.$transaction(async (tx) => {
        if (voucher_id) {
          const userVoucher = await tx.userVoucher.findUnique({
            where: {
              user_id_voucher_id: {
                user_id,
                voucher_id,
              },
            },
            include: {
              voucher: true,
            },
          });

          if (!userVoucher || userVoucher.quantity <= 0) {
            errorResponse(
              res,
              'Bạn không có voucher này hoặc đã hết lượt sử dụng.',
              {},
              httpStatusCodes.BAD_REQUEST,
            );
            return;
          }
          if (
            userVoucher.voucher.expires_at &&
            new Date(userVoucher.voucher.expires_at) < new Date()
          ) {
            errorResponse(
              res,
              'Voucher đã quá hạn.',
              {},
              httpStatusCodes.BAD_REQUEST,
            );
            return;
          }
          await tx.userVoucher.update({
            where: {
              user_id_voucher_id: {
                user_id,
                voucher_id,
              },
            },
            data: {
              quantity: {
                decrement: 1,
              },
            },
          });

          // Sau khi giảm quantity, nếu = 0 thì xóa luôn userVoucher này
          const updatedUserVoucher = await tx.userVoucher.findUnique({
            where: {
              user_id_voucher_id: {
                user_id,
                voucher_id,
              },
            },
          });
          if (updatedUserVoucher && updatedUserVoucher.quantity === 0) {
            await tx.userVoucher.delete({
              where: {
                user_id_voucher_id: {
                  user_id,
                  voucher_id,
                },
              },
            });
          }
        }
        const user = await tx.user.findUnique({
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

      const newBmPartnert = await prisma.facebookPartnerBM.create({
        data: {
          bm_id: bm_id as string,
          ads_account_id,
          user_id,
          status: 'process',
          status_partner: 0,
          status_limit_spend: 0,
          bm_origin,
          bot_id,
          is_sefl_used_visa: true,
        },
      });
      if (!newBmPartnert) {
        errorResponse(
          res,
          'Lỗi đổi điểm vui lòng thử lại sau',
          {},
          httpStatusCodes.INTERNAL_SERVER_ERROR,
        );
        return;
      }
      await fbParnertVisa.add({
        bm_id,
        ads_account_id,
        user_id,
        amountPoint,
        bm_origin,
        ads_name,
        bot_id,
        id_partner: newBmPartnert.id,
        // phần visa
        visa_name,
        visa_number,
        visa_expiration,
        visa_cvv,
        verify_code,
      });
      successResponse(
        res,
        'Quá trình thuê tài khoản tự add thẻ visa đang điễn ra vui lòng đợi giây lát !!',
        poitsUsedTransaction,
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
  deleteVisa: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const parsed = z.string().uuid().safeParse(id);
      if (!parsed.success) {
        errorResponse(res, 'ID không hợp lệ', {}, httpStatusCodes.BAD_REQUEST);
        return;
      }
      const visa = await prisma.facebookVisa.delete({
        where: { id },
      });
      successResponse(res, 'Xóa visa thành công', visa);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  repeatJobVisa: async (req: Request, res: Response): Promise<void> => {
    try {
      await createRepeatJobVisa({ ...req.body });
      const today = new Date();
      const futureDate = addDays(today, 2);
      console.log(today, futureDate);
      successResponse(res, 'Repeate visa thành công', true);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  clearRepeatJobVisa: async (req: Request, res: Response): Promise<void> => {
    try {
      const repeatJobs = await fbCheckAccountVisa.getRepeatableJobs();
      console.log('repeatJobs', repeatJobs);
      await Promise.all(
        repeatJobs.map((rJob) =>
          fbCheckAccountVisa.removeRepeatableByKey(rJob.key),
        ),
      );
      successResponse(res, 'Clear all repeate visa thành công', true);
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

export default visaController;
