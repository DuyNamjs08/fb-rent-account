import roleService from '../services/Roles.service';
import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpReasonCodes } from '../helpers/reasonPhrases';
import { httpStatusCodes } from '../helpers/statusCodes';
import CryptoJS from 'crypto-js';
import prisma from '../config/prisma';
const SECRET_KEY = process.env.ENCRYPTION_KEY_SECRET;

export function encryptToken(token: string) {
  if (!SECRET_KEY) {
    throw new Error('Missing SECRET_KEY in environment variables');
  }
  const ciphertext = CryptoJS.AES.encrypt(token, SECRET_KEY).toString();
  return ciphertext;
}
export function decryptToken(ciphertext: string) {
  if (!SECRET_KEY) {
    throw new Error('Missing SECRET_KEY in environment variables');
  }
  const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
  const originalText = bytes.toString(CryptoJS.enc.Utf8);
  return originalText;
}
const facebookBmController = {
  createBM: async (req: Request, res: Response): Promise<void> => {
    try {
      const { bm_name, bm_id, system_user_token } = req.body;
      if (!bm_id || !bm_name || !system_user_token) {
        errorResponse(
          res,
          'Thiếu các trường thông tin khi tạo BM',
          {},
          httpStatusCodes.INTERNAL_SERVER_ERROR,
        );
        return;
      }
      const encodeSystemUser = await encryptToken(system_user_token);
      const facebookBm = await prisma.facebookBM.create({
        data: {
          bm_name,
          bm_id,
          system_user_token: encodeSystemUser,
        },
      });

      successResponse(res, 'Tạo facebook BM thành công', facebookBm);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },

  getAllFacebookBM: async (req: Request, res: Response): Promise<void> => {
    try {
      const facebookBm = await prisma.facebookBM.findMany({});
      successResponse(res, 'Danh sách facebook bm', facebookBm);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  updateFacebookBM: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, bm_name, bm_id, system_user_token } = req.body;
      const facebookBm = await prisma.facebookBM.findUnique({
        where: {
          id: id,
        },
      });
      if (!facebookBm) {
        errorResponse(
          res,
          httpReasonCodes.NOT_FOUND,
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }
      const fbExist = await prisma.facebookBM.findUnique({
        where: {
          bm_id: bm_id,
        },
      });
      if (fbExist) {
        errorResponse(res, 'BM_ID đã tồn tại', {}, httpStatusCodes.NOT_FOUND);
        return;
      }
      const encodeSystemUser = await encryptToken(system_user_token);
      const fbBMNew = await prisma.facebookBM.update({
        where: {
          id: id,
        },
        data: {
          bm_name,
          bm_id,
          system_user_token: encodeSystemUser,
        },
      });
      successResponse(res, 'Cập nhật facebook bm công !', fbBMNew);
    } catch (error: any) {
      const statusCode = error.message.includes('not found') ? 404 : 400;
      if (statusCode === 404) {
        errorResponse(res, httpReasonCodes.NOT_FOUND, error, statusCode);
      } else {
        errorResponse(res, error?.message, error, statusCode);
      }
    }
  },
  deleteFacebookBm: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const facebookBm = await prisma.facebookBM.findUnique({
        where: {
          id: id,
        },
      });
      if (!facebookBm) {
        errorResponse(
          res,
          httpReasonCodes.NOT_FOUND,
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }
      await prisma.facebookBM.delete({
        where: {
          id: id,
        },
      });
      successResponse(res, 'Xóa bm thành công !', true);
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
};

export default facebookBmController;
