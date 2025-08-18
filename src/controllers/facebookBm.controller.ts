import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpReasonCodes } from '../helpers/reasonPhrases';
import { httpStatusCodes } from '../helpers/statusCodes';
import CryptoJS from 'crypto-js';
import prisma from '../config/prisma';
import { z } from 'zod';
import { fbRealtimeCheckDisable } from '../workers/fb-check-disable';
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
const createBmSchema = z.object({
  bm_id: z.string().min(1, 'bm_id is required'),
  bm_name: z.string().min(1, 'bm_name is required'),
  system_user_token: z.string().min(1, 'system_user_token is required'),
});
const getIdSchema = z.object({
  id: z.string().min(1, 'id is required'),
});
const facebookBmController = {
  createBM: async (req: Request, res: Response): Promise<void> => {
    try {
      const { bm_name, bm_id, system_user_token } = req.body;
      const parsed = createBmSchema.safeParse(req.body);
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
      const encodeSystemUser = await encryptToken(system_user_token);
      const facebookBm = await prisma.facebookBM.create({
        data: {
          bm_name,
          bm_id,
          system_user_token: encodeSystemUser,
        },
      });

      successResponse(res, req.t('create_facebook_bm_success'), facebookBm);
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
      successResponse(res, req.t('facebook_bm_list'), facebookBm);
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
      const { bm_name, bm_id, system_user_token } = req.body;
      const parsed = createBmSchema.safeParse(req.body);
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
      const fbExist = await prisma.facebookBM.findUnique({
        where: {
          bm_id: bm_id,
        },
      });
      if (!fbExist) {
        errorResponse(
          res,
          req.t('bm_id_already_exists'),
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }
      const encodeSystemUser = await encryptToken(system_user_token);
      const fbBMNew = await prisma.facebookBM.update({
        where: {
          id: fbExist.id,
        },
        data: {
          bm_name: bm_name || (fbExist.bm_name as string),
          bm_id: bm_id || (fbExist.bm_id as string),
          system_user_token: encodeSystemUser,
        },
      });
      await fbRealtimeCheckDisable.obliterate({ force: true });
      await fbRealtimeCheckDisable.add(
        {},
        {
          attempts: 3,
          repeat: { every: 10 * 60 * 1000 },
        },
      );
      successResponse(res, req.t('update_facebook_bm_success'), fbBMNew);
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
      const { id } = req.query;

      const parsed = getIdSchema.safeParse({ id });
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
      const facebookBm = await prisma.facebookBM.findUnique({
        where: {
          id: id as string,
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
          id: id as string,
        },
      });
      successResponse(res, req.t('delete_bm_success'), true);
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

export default facebookBmController;
