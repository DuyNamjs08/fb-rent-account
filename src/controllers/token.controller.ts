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
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
});
const updateAccessTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token không được để trống'),
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').optional(),
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
          'Dữ liệu không hợp lệ',
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
          'Tài khoản không tồn tại hoặc đã bị khóa',
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }
      const byHash = await bcrypt.compare(req.body.password, user.password);
      if (!byHash) {
        errorResponse(
          res,
          'Tài khoản hoặc mật khẩu không chính xác',
          {},
          httpStatusCodes.UNAUTHORIZED,
        );
        return;
      }
      if (
        !process.env.ACCESS_TOKEN_SECRET ||
        !process.env.REFRESH_TOKEN_SECRET
      ) {
        errorResponse(
          res,
          'Token secrets are not defined in environment variables',
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
      successResponse(res, 'Success create', Token);
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
          'Dữ liệu đầu vào không hợp lệ',
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
          'Tài khoản không tồn tại hoặc đã bị khóa',
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
          'Token secrets are not defined in environment variables',
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
            return res.status(405).json('refresh token không hợp lệ');
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
            'Cập nhật access token thành công',
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
          'Tài khoản không tồn tại',
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }

      if (!process.env.ACCESS_TOKEN_SECRET) {
        errorResponse(
          res,
          'Reset token secret not defined',
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
        throw new Error('File HTML không tồn tại');
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

      successResponse(res, 'Email đặt lại mật khẩu đã được gửi', {});
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
          'Token và mật khẩu mới là bắt buộc',
          {},
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }

      if (!process.env.ACCESS_TOKEN_SECRET) {
        errorResponse(
          res,
          'Reset token secret not defined',
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
              'Token không hợp lệ hoặc đã hết hạn',
              {},
              httpStatusCodes.FORBIDDEN,
            );
          }
          const user = await UserService.getUserById(data.user_id);
          if (!user) {
            return errorResponse(
              res,
              'Tài khoản không tồn tại',
              {},
              httpStatusCodes.NOT_FOUND,
            );
          }
          const hashedPassword = await bcrypt.hash(newPassword, 10);
          await UserService.updateUser(user.id, { password: hashedPassword });
          successResponse(res, 'Đặt lại mật khẩu thành công', {});
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
