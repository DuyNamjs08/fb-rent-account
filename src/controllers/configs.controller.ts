import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpStatusCodes } from '../helpers/statusCodes';
import prisma from '../config/prisma';
import { httpReasonCodes } from '../helpers/reasonPhrases';
import { z } from 'zod';
import { encryptToken } from './facebookBm.controller';
export const configSchema = z.object({
  lang: z.string().default('vi'),
  admin_mail: z.string().email({ message: 'Invalid admin_mail' }),
  user_mail: z.string().email({ message: 'Invalid user_mail' }),
  user_mail_pass: z.string().min(1, 'user_mail_pass is required'),
  email_app_pass: z.string().min(1, 'email_app_pass is required'),
  email_app: z.string().email({ message: 'Invalid email_app' }),
});
const ConfigController = {
  createConfig: async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        lang,
        admin_mail,
        user_mail,
        email_app,
        email_app_pass,
        user_mail_pass,
      } = req.body;
      const parsed = configSchema.safeParse(req.body);
      if (!parsed.success) {
        const errors = parsed.error.flatten().fieldErrors;
        errorResponse(
          res,
          req.t('invalid_data'),
          errors,
          httpStatusCodes.INTERNAL_SERVER_ERROR,
        );
        return;
      }
      const configs = await prisma.config.findFirst({
        where: {
          name: 'config-settings',
        },
      });
      const encodeEmailAppPass = await encryptToken(email_app_pass);
      const encodeUserEmailAppPass = await encryptToken(user_mail_pass);
      if (!encodeEmailAppPass && !encodeUserEmailAppPass) {
        errorResponse(
          res,
          req.t('decode_error'),
          {},
          httpStatusCodes.INTERNAL_SERVER_ERROR,
        );
        return;
      }
      let ConfigNew = {};
      if (configs) {
        ConfigNew = await prisma.config.update({
          where: { id: configs.id },
          data: {
            lang,
            admin_mail,
            user_mail,
            email_app,
            email_app_pass: encodeEmailAppPass,
            user_mail_pass: encodeUserEmailAppPass,
          },
        });
        successResponse(res, req.t('create_config_success'), ConfigNew);
        return;
      } else {
        ConfigNew = await prisma.config.create({
          data: {
            lang,
            admin_mail,
            user_mail,
            email_app,
            email_app_pass: encodeEmailAppPass,
            user_mail_pass: encodeUserEmailAppPass,
          },
        });
      }
      successResponse(res, req.t('create_config_success'), ConfigNew);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  getConfigs: async (req: Request, res: Response): Promise<void> => {
    try {
      const Configs = await prisma.config.findMany({});
      successResponse(res, 'Configs settings success', Configs);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  deleteConfigs: async (req: Request, res: Response): Promise<void> => {
    try {
      const ConfigsExist = await prisma.config.findFirst({
        where: { name: 'config-settings' },
      });
      if (!ConfigsExist) {
        errorResponse(res, httpReasonCodes.NOT_FOUND, {}, 404);
        return;
      }

      const Config = await prisma.config.delete({
        where: { id: ConfigsExist.id },
      });
      successResponse(res, req.t('delete_config_success'), Config);
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

export default ConfigController;
