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
import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';
import mustache from 'mustache';
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
  bm_id: z.string().min(1, 'bm_id is required'),
  ads_account_id: z.string().min(1, 'ads_account_id is required'),
  user_id: z.string().min(1, 'user_id is required'),
  amountPoint: z.number().positive('please enter an amount greater than 0'),
  bm_origin: z.string().min(1, 'bm_origin is required'),
  ads_name: z.string().min(1, 'ads_name is required'),
  bot_id: z.string().min(1, 'bot_id is required'),
  voucher_id: z.string().optional(),
  currency: z.string().min(3, 'currency is required and min 3 character'),
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
          req.t('invalid_data'),
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
            req.t('visa_not_found'),
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
        successResponse(res, req.t('update_visa_success'), visa);
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
      successResponse(res, req.t('create_visa_success'), visa);
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
        // phần dùng tiền usd
        currency,
      } = req.body;
      const parsed = createChargeSchema.safeParse(req.body);
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
      const user = await prisma.user.findUnique({
        where: { id: user_id },
        select: { points: true, percentage: true, username: true },
      });

      if (!user) {
        errorResponse(
          res,
          req.t('user_not_found'),
          {},
          httpStatusCodes.NOT_FOUND,
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
              req.t('voucher_invalid_or_used'),
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
              req.t('voucher_expired'),
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
            req.t('user_not_found'),
            {},
            httpStatusCodes.NOT_FOUND,
          );
          return;
        }

        if (user.points < amountVNDchange) {
          errorResponse(
            res,
            req.t('not_enough_points'),
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
        if (currency == 'usd') {
          await tx.user.update({
            where: { id: user_id },
            data: {
              amount_usd: { decrement: amountVNDchange },
            },
          });
        } else {
          await tx.user.update({
            where: { id: user_id },
            data: {
              points: { decrement: amountVNDchange },
            },
          });
        }
        const pointsUsed = await tx.pointUsage.create({
          data: {
            user_id,
            points_used: amountVNDchange,
            target_account: ads_account_id,
            description: 'Đổi điểm tài khoản quảng cáo',
            status: 'success',
            currency,
          },
        });
        return pointsUsed;
      });
      if (!poitsUsedTransaction) {
        errorResponse(
          res,
          req.t('point_exchange_error'),
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
          req.t('point_exchange_error'),
          {},
          httpStatusCodes.INTERNAL_SERVER_ERROR,
        );
        return;
      }
      const pathhtml = path.resolve(__dirname, '../html/rent-success.html');
      const pathhtmlError = path.resolve(__dirname, '../html/rent-error.html');
      let htmlContent = fs.readFileSync(pathhtml, 'utf-8');
      let htmlContentV2 = fs.readFileSync(pathhtmlError, 'utf-8');
      const renderedHtmlSuccess = mustache.render(htmlContent, {
        accountName: user.username,
        rentDuration: format(
          new Date(newBmPartnert.created_at),
          'dd/MM/yyyy HH:mm:ss',
        ),
        ads_name: ads_name,
        amountPoint: amountVNDchange,
        bm_id: bm_id,
        // Truyền từng key đã dịch sẵn
        success_title: req.t('email.success_title'),
        failed_title: req.t('email.failed_title'),
        error_notice: req.t('email.error_notice'),
        error_detail: req.t('email.error_detail'),
        hello: req.t('email.hello'),
        rent_success_desc: req.t('email.rent_success_desc'),
        account_info: req.t('email.account_info'),
        account_name: req.t('email.account_name'),
        rent_duration: req.t('email.rent_duration'),
        start_time: req.t('email.start_time'),
        ads_name_text: req.t('email.ads_name'),
        bm_id_text: req.t('email.bm_id'),
        amount_point: req.t('email.amount_point'),
        activated: req.t('email.activated'),
        need_support: req.t('email.need_support'),
        support_desc: req.t('email.support_desc'),
        support_btn: req.t('email.support_btn'),
        regards: req.t('email.regards'),
        team_name: req.t('email.team_name'),
      });
      const renderedHtmlError = mustache.render(htmlContentV2, {
        accountName: user.username,
        rentDuration: format(
          new Date(newBmPartnert.created_at),
          'dd/MM/yyyy HH:mm:ss',
        ),
        ads_name: ads_name,
        amountPoint: amountVNDchange,
        bm_id: bm_id,
        // Truyền từng key đã dịch sẵn
        success_title: req.t('email.success_title'),
        failed_title: req.t('email.failed_title'),
        error_notice: req.t('email.error_notice'),
        error_detail: req.t('email.error_detail'),
        hello: req.t('email.hello'),
        rent_success_desc: req.t('email.rent_success_desc'),
        account_info: req.t('email.account_info'),
        account_name: req.t('email.account_name'),
        rent_duration: req.t('email.rent_duration'),
        start_time: req.t('email.start_time'),
        ads_name_text: req.t('email.ads_name'),
        bm_id_text: req.t('email.bm_id'),
        amount_point: req.t('email.amount_point'),
        activated: req.t('email.activated'),
        need_support: req.t('email.need_support'),
        support_desc: req.t('email.support_desc'),
        support_btn: req.t('email.support_btn'),
        regards: req.t('email.regards'),
        team_name: req.t('email.team_name'),
      });
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
        // phần check tiền tệ
        currency,
        renderedHtmlSuccess,
        renderedHtmlError,
        titlEmailSucces: req.t('subject_add_account_visa_success'),
        titlEmailError: req.t('subject_add_account_visa_failed'),
      });
      successResponse(
        res,
        req.t('auto_rent_visa_in_progress'),
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
