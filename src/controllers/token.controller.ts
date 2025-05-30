import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpStatusCodes } from '../helpers/statusCodes';
import TokenService from '../services/Token.service';
import UserService from '../services/User.service';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { sendEmail } from './mails.controller';
import fs from 'fs';
import path from 'path';

const TokenController = {
  createAccessToken: async (req: Request, res: Response): Promise<void> => {
    try {
      console.log('__dirname', __dirname);
      const pathhtml = path.resolve(__dirname, '../html/index.html');
      console.log('pathhtml', pathhtml);
      let htmlContent = fs.readFileSync(pathhtml, 'utf-8');
      const data = req.body;
      const user = await UserService.getUserByEmail(data.email);
      if (!user) {
        errorResponse(
          res,
          'Tài khoản không tồn tại',
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
        const emailLog = await prisma.emailLog.create({
          data: {
            user_id: user.id,
            to: user.email,
            subject: 'AKAds thông báo đăng nhập',
            body: htmlContent
              .replace('{{name}}', user.username || 'Người dùng')
              .replace('{{loginTime}}', new Date().toLocaleString()),
            status: 'success',
            type: 'login_notification',
          },
        });
        console.log('emailLog', emailLog);
        console.log('user.email', user.email);
        await sendEmail({
          email: user.email,
          subject: 'AKAds thông báo đăng nhập',
          message: htmlContent
            .replace('{{name}}', user.username || 'Người dùng')
            .replace('{{loginTime}}', new Date().toLocaleString()),
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
      // gửi mail thông báo đăng nhập thành công

      const emailLog = await prisma.emailLog.create({
        data: {
          user_id: user.id,
          to: user.email,
          subject: 'AKAds thông báo đăng nhập',
          body: htmlContent
            .replace('{{name}}', user.username || 'Người dùng')
            .replace('{{loginTime}}', new Date().toLocaleString()),
          status: 'success',
          type: 'login_notification',
        },
      });
      console.log('emailLog', emailLog);
      await sendEmail({
        email: user.email,
        subject: 'AKAds thông báo đăng nhập',
        message: htmlContent
          .replace('{{name}}', user.username || 'Người dùng')
          .replace('{{loginTime}}', new Date().toLocaleString()),
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
      if (!refresh_token) {
        errorResponse(
          res,
          'Refresh token không được để trống',
          {},
          httpStatusCodes.BAD_REQUEST,
        );
        return;
      }
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
            return res.status(403).json('refresh token không hợp lệ');
          }
          const accessToken = jwt.sign(
            { mail: data.email, password: data.password, user_id: user.id },
            process.env.ACCESS_TOKEN_SECRET as string,
            {
              expiresIn: '1m',
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
};
export default TokenController;
