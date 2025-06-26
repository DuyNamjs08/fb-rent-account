import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpStatusCodes } from '../helpers/statusCodes';
import TokenService from '../services/Token.service';
import UserService from '../services/User.service';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { sendEmail } from './mails.controller';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
const createAccessTokenSchema = z.object({
  email: z.string().email('invalid email'),
  password: z.string().min(6, 'password must be at least 6 characters'),
});

const updateAccessTokenSchema = z.object({
  refresh_token: z.string().min(1, 'refresh token is required'),
  email: z.string().email('invalid email'),
  password: z
    .string()
    .min(6, 'password must be at least 6 characters')
    .optional(),
});
const TokenController = {
  createAccessToken: async (req: Request, res: Response): Promise<void> => {
    try {
      const data = req.body;
      const parsed = createAccessTokenSchema.safeParse(data);
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
      const user = await prisma.user.findFirst({
        where: {
          email: data.email,
          active: true,
        },
      });
      if (!user) {
        errorResponse(
          res,
          req.t('account_not_found_or_locked'),
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }
      const byHash = await bcrypt.compare(req.body.password, user.password);
      if (!byHash) {
        errorResponse(
          res,
          req.t('incorrect_credentials'),
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }
      if (
        !process.env.ACCESS_TOKEN_SECRET ||
        !process.env.REFRESH_TOKEN_SECRET
      ) {
        errorResponse(
          res,
          req.t('token_secrets_missing'),
          {},
          httpStatusCodes.INTERNAL_SERVER_ERROR,
        );
        return;
      }
      const accessToken = jwt.sign(
        { ...data, user_id: user.id },
        process.env.ACCESS_TOKEN_SECRET,
        {
          expiresIn: '1d',
        },
      );
      const refreshToken = jwt.sign(
        { ...data, user_id: user.id },
        process.env.REFRESH_TOKEN_SECRET,
        {
          expiresIn: '7d',
        },
      );
      const tokenExists = await TokenService.findTokenByUserId({
        user_id: user.id,
      });
      if (tokenExists) {
        const Token = await TokenService.updateAccessToken(user.id, {
          user_id: user.id,
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        successResponse(res, 'Success', Token);
        return;
      }
      const Token = await TokenService.createtoken({
        data: {
          user_id: user.id,
          access_token: accessToken,
          refresh_token: refreshToken,
        },
      });
      successResponse(res, req.t('token_create_success'), Token);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  updateAccessToken: async (req: Request, res: Response): Promise<void> => {
    try {
      const { refresh_token, email, password } = req.body;

      const parseResult = updateAccessTokenSchema.safeParse(req.body);
      if (!parseResult.success) {
        errorResponse(
          res,
          req.t('invalid_data'),
          parseResult.error.format(),
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
      const user = await prisma.user.findFirst({
        where: {
          email: email,
          active: true,
        },
      });
      if (!user) {
        errorResponse(
          res,
          req.t('account_not_found_or_locked'),
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }
      if (
        !process.env.ACCESS_TOKEN_SECRET ||
        !process.env.REFRESH_TOKEN_SECRET
      ) {
        errorResponse(
          res,
          req.t('token_secrets_missing'),
          null,
          httpStatusCodes.INTERNAL_SERVER_ERROR,
        );
        return;
      }
      jwt.verify(
        refresh_token,
        process.env.REFRESH_TOKEN_SECRET,
        async (err: any, data: any) => {
          if (err) {
            return res.status(405).json(req.t('invalid_refresh_token'));
          }
          const accessToken = jwt.sign(
            { mail: data.email, password: data.password, user_id: user.id },
            process.env.ACCESS_TOKEN_SECRET as string,
            {
              expiresIn: '7d',
            },
          );
          const updateAccessToken = await TokenService.updateAccessToken(
            user.id,
            {
              access_token: accessToken,
              refresh_token: refresh_token,
              user_id: user.id,
            },
          );
          successResponse(
            res,
            req.t('access_token_updated'),
            updateAccessToken,
          );
          return;
        },
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
  forgotPassword: async (req: Request, res: Response) => {
    try {
      const BaseUrl = process.env.VITE_URL;
      const { email } = req.body;
      const user = await UserService.getUserByEmail(email);
      if (!user) {
        errorResponse(
          res,
          req.t('account_not_found'),
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }

      if (!process.env.ACCESS_TOKEN_SECRET) {
        errorResponse(
          res,
          req.t('reset_token_secret_missing'),
          {},
          httpStatusCodes.INTERNAL_SERVER_ERROR,
        );
        return;
      }

      // Tạo token đặt lại mật khẩu
      const resetToken = jwt.sign(
        { user_id: user.id, email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: '15m' },
      );
      // Tạo liên kết đặt lại mật khẩu
      const resetLink = `${BaseUrl}/reset-password?token=${resetToken}`;
      // Đọc template HTML
      const pathhtml = path.resolve(__dirname, '../html/reset-password.html');
      if (!fs.existsSync(pathhtml)) {
        throw new Error(req.t('html_file_exist'));
      }
      let htmlContent = fs.readFileSync(pathhtml, 'utf-8');
      htmlContent = htmlContent
        .replace('{{NAME}}', user.username || 'Người dùng')
        .replace('{{RESET_URL}}', resetLink)
        .replace('{{USER_EMAIL}}', user.email)
        .replace('{{COMPANY_NAME}}', 'AKA Media')
        .replace('{{SUPPORT_EMAIL}}', 'support@akads.vn');

      // Lưu log email
      await prisma.emailLog.create({
        data: {
          user_id: user.id,
          to: user.email,
          subject: 'AKAds Đặt lại mật khẩu',
          body: htmlContent,
          status: 'success',
          type: 'reset_password',
        },
      });

      // Gửi email
      await sendEmail({
        email: user.email,
        subject: 'AKAds Đặt lại mật khẩu',
        message: htmlContent,
      });

      successResponse(res, req.t('password_reset_email_sent'), {});
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  resetPassword: async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        errorResponse(
          res,
          req.t('token_and_password_required'),
          {},
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }

      if (!process.env.ACCESS_TOKEN_SECRET) {
        errorResponse(
          res,
          req.t('reset_token_secret_missing'),
          {},
          httpStatusCodes.INTERNAL_SERVER_ERROR,
        );
        return;
      }

      jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET,
        async (err: any, data: any) => {
          if (err) {
            return errorResponse(
              res,
              req.t('invalid_or_expired_token'),
              {},
              httpStatusCodes.FORBIDDEN,
            );
          }
          const user = await UserService.getUserById(data.user_id);
          if (!user) {
            return errorResponse(
              res,
              req.t('account_not_found'),
              {},
              httpStatusCodes.NOT_FOUND,
            );
          }
          const hashedPassword = await bcrypt.hash(newPassword, 10);
          await UserService.updateUser(user.id, { password: hashedPassword });
          successResponse(res, req.t('password_reset_success'), {});
        },
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
};
export default TokenController;
