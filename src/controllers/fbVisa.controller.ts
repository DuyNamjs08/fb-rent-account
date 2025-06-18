import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpReasonCodes } from '../helpers/reasonPhrases';
import { httpStatusCodes } from '../helpers/statusCodes';
import prisma from '../config/prisma';
import { z } from 'zod';
export const FacebookVisaSchema = z.object({
  id: z.string().uuid().optional(),
  visa_name: z.string().min(1, 'visa_name is required'),
  visa_number: z.string().min(1, 'visa_number is required'),
  visa_expiration: z.string().min(1, 'visa_expiration is required'),
  visa_cvv: z.string().min(1, 'visa_cvv is required'),
  verify_code: z.string().min(1, 'verify_code is required'),
  bm_name: z.string().min(1, 'bm_name is required'),
  bm_origin: z.string().min(1, 'bm_origin is required'),
  ads_account_id: z.string().min(1, 'ads_account_id is required'),
  user_id: z.string().min(1, 'user_id is required'),
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
};

export default visaController;
