import { Request, Response } from 'express';
import { errorResponse, successResponse } from '../helpers/response';
import { httpStatusCodes } from '../helpers/statusCodes';
import { httpReasonCodes } from '../helpers/reasonPhrases';
import prisma from '../config/prisma';
import { uploadToR2 } from '../middlewares/upload.middleware';
import { z } from 'zod';
import path from 'path';
import UserService from '../services/User.service';
import fs from 'fs';
import { sendEmail, sendEmailFromUser } from './mails.controller';
import { format } from 'date-fns';

// import roleService from "../services/Roles.service";

const supportController = {
  createSupport: async (req: Request, res: Response): Promise<void> => {
    try {
      const supportRequestSchema = z.object({
        fullName: z.string().min(1, 'Họ tên không được để trống'),
        email: z.string().email('Email không hợp lệ'),
        phone: z.string().min(10, 'Số điện thoại không hợp lệ'),
        title: z.string().min(1, 'Tiêu đề không được để trống'),
        department: z
          .string()
          .refine((val) => ['tech', 'sales', 'hr'].includes(val), {
            message: 'Phòng ban không hợp lệ',
          }),
        content: z.string().min(1, 'Nội dung không được để trống'),
        user_id: z.string().optional(),
        status: z.string().optional(),
        priority: z
          .string()
          .refine((val) => ['low', 'medium', 'high', 'urgent'].includes(val), {
            message: 'Mức độ không hợp lệ',
          }),
        category: z
          .string()
          .refine(
            (val) => ['account', 'pay', 'recover', 'other'].includes(val),
            { message: 'Danh mục không hợp lệ' },
          ),
      });

      const validatedData = supportRequestSchema.parse(req.body);
      const {
        fullName,
        email,
        phone,
        title,
        department,
        content,
        user_id,
        status = 'pending',
        priority,
        category,
      } = validatedData;

      let attachments: string[] = [];

      // Xử lý file ảnh nếu có
      if (req.files && (req.files as Express.Multer.File[]).length > 0) {
        const allFiles = req.files as Express.Multer.File[];
        const images = allFiles.filter((file) =>
          file.mimetype.startsWith('image/'),
        );

        if (images.length === 0) {
          throw new Error(
            'Không có file hình ảnh hợp lệ được tải lên (.jpg, .jpeg, .png)',
          );
        }

        // Hàm upload file lên R2
        const uploadFiles = async (
          files: Express.Multer.File[],
        ): Promise<string[]> => {
          return Promise.all(
            files.map(async (file) => {
              const timestamp = Date.now();
              const originalFilename = file.originalname.replace(/\s/g, '_');
              const newFilename = `support-requests/${originalFilename}-${timestamp}${path.extname(file.originalname)}`;
              const result = await uploadToR2(file.path, newFilename);
              return `${process.env.R2_PUBLIC_URL}/${result.Key}`;
            }),
          );
        };

        attachments = await uploadFiles(images);
      }

      const supportRequest = await prisma.supportRequests.create({
        data: {
          fullName,
          email,
          phone,
          title,
          department,
          content,
          attachments,
          user_id: user_id || null,
          status,
          category,
          priority,
        },
      });

      successResponse(res, 'Tạo yêu cầu hỗ trợ thành công', supportRequest);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        errorResponse(
          res,
          'Dữ liệu đầu vào không hợp lệ',
          error.errors,
          httpStatusCodes.BAD_REQUEST,
        );
      } else if (
        error.message.includes('Loại file không được hỗ trợ') ||
        error.message.includes('hình ảnh hợp lệ')
      ) {
        errorResponse(res, error.message, error, httpStatusCodes.BAD_REQUEST);
      } else if (error.message.includes('File too large')) {
        errorResponse(
          res,
          'File tải lên quá lớn (tối đa 10MB)',
          error, // httpStatusCodes.PAYLOAD_TOO_LARGE,
        );
      } else {
        errorResponse(
          res,
          error?.message || 'Có lỗi xảy ra khi tạo yêu cầu hỗ trợ',
          error,
          httpStatusCodes.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }, // load more, search, filter
  getAllSupport: async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = '1',
        limit,
        search = '',
        status = '',
        priority = '',
      } = req.query;

      const pageNumber = parseInt(page as string, 10) || 1;
      const pageSize = parseInt(limit as string, 10) || 10;
      const skip = (pageNumber - 1) * pageSize;

      const where: any = {};
      if (search) {
        where.OR = [
          {
            title: {
              contains: search as string,
              mode: 'insensitive',
            },
          },
          { content: { contains: search as string, mode: 'insensitive' } },
          {
            fullName: {
              contains: search as string,
              mode: 'insensitive',
            },
          },
          { email: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      if (status && status !== 'all') {
        where.status = status as string;
      }

      if (priority && priority !== 'all') {
        where.priority = priority as string;
      }

      const supportRequests = await prisma.supportRequests.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { updated_at: 'desc' },
      });

      const totalRecords = await prisma.supportRequests.count({ where });

      successResponse(res, 'Danh sách yêu cầu hỗ trợ', {
        data: supportRequests,
        pagination: {
          page: pageNumber,
          limit: pageSize,
          totalRecords,
          totalPages: Math.ceil(totalRecords / pageSize),
        },
      });
    } catch (error: any) {
      errorResponse(
        res,
        error?.message || 'Lỗi server',
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  getSupportById: async (
    req: Request,
    res: Response,
    id: any,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const supportRequest = await prisma.supportRequests.findUnique({
        where: {
          id: id,
        },
      });
      successResponse(res, 'Success', supportRequest);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  getSupportByUserId: async (
    req: Request,
    res: Response,
    id: any,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const user = await prisma.user.findUnique({
        where: {
          id: id,
        },
      });
      if (!user) {
        errorResponse(res, req.t('user_not_found'), {}, 404);
        return;
      }

      const {
        page = '1',
        limit,
        search = '',
        status = '',
        priority = '',
      } = req.query;

      const pageNumber = parseInt(page as string, 10) || 1;
      const pageSize = parseInt(limit as string, 10) || 10;
      const skip = (pageNumber - 1) * pageSize;

      const where: any = {
        user_id: id,
      };

      if (search) {
        where.OR = [
          {
            title: {
              contains: search as string,
              mode: 'insensitive',
            },
          },
          { content: { contains: search as string, mode: 'insensitive' } },
          {
            fullName: {
              contains: search as string,
              mode: 'insensitive',
            },
          },
          { email: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      if (status && status !== 'all') {
        where.status = status as string;
      }

      if (priority && priority !== 'all') {
        where.priority = priority as string;
      }
      const totalRecords = await prisma.supportRequests.count({ where });

      const supportRequests = await prisma.supportRequests.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: {
          updated_at: 'desc',
        },
      });
      successResponse(res, 'Danh sách yêu cầu hỗ trợ', {
        data: supportRequests,
        pagination: {
          page: pageNumber,
          limit: pageSize,
          totalRecords,
          totalPages: Math.ceil(totalRecords / pageSize),
        },
      });
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  deleteSupport: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const supportRequest = await prisma.supportRequests.findUnique({
        where: {
          id: id,
        },
      });
      if (!supportRequest) {
        errorResponse(
          res,
          httpReasonCodes.NOT_FOUND,
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }
      await prisma.supportRequests.delete({
        where: {
          id: id,
        },
      });
      successResponse(res, 'Xóa yêu cầu hỗ trợ thành công !', true);
    } catch (error: any) {
      const statusCode = error.message.includes('not found') ? 404 : 400;
      if (statusCode === 404) {
        errorResponse(res, httpReasonCodes.NOT_FOUND, error, statusCode);
      } else {
        errorResponse(res, error?.message, error, statusCode);
      }
    }
  },
  createMessage: async (req: Request, res: Response): Promise<void> => {
    const { supportRequestId, senderId, message } = req.body;

    if (!supportRequestId || !senderId || !message) {
      errorResponse(
        res,
        httpReasonCodes.NOT_FOUND,
        {},
        httpStatusCodes.NOT_FOUND,
      );
      return;
    }

    try {
      const supportRequest = await prisma.supportRequests.findUnique({
        where: { id: supportRequestId },
      });

      if (!supportRequest) {
        errorResponse(
          res,
          httpReasonCodes.NOT_FOUND,
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }

      const sender = await prisma.user.findUnique({
        where: { id: senderId },
      });

      if (!sender) {
        errorResponse(
          res,
          httpReasonCodes.NOT_FOUND,
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }

      const newMessage = await prisma.messageRequest.create({
        data: {
          supportRequestId,
          senderId,
          message,
        },
        include: {
          sender: {
            select: {
              id: true,
              email: true,
              username: true,
              role: true,
              images: true,
              phone: true,
            },
          },
        },
      });

      successResponse(res, 'Tạo tin nhắn thành công', newMessage);
    } catch (error: any) {
      errorResponse(
        res,
        error.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  getMessageByRequestId: async (req: Request, res: Response) => {
    try {
      const supportRequestId = req.params.id;
      const supportRequest = await prisma.supportRequests.findUnique({
        where: {
          id: supportRequestId,
        },
      });

      if (!supportRequest) {
        errorResponse(
          res,
          httpReasonCodes.NOT_FOUND,
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }

      const message = await prisma.messageRequest.findMany({
        where: {
          supportRequestId,
        },
        orderBy: {
          created_at: 'asc',
        },
        include: {
          sender: {
            select: {
              id: true,
              email: true,
              username: true,
              role: true,
              images: true,
              phone: true,
            },
          },
        },
      });

      successResponse(res, 'Lấy tin nhắn thành công', message);
    } catch (error: any) {
      errorResponse(
        res,
        error.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  updateStatusByRequestId: async (req: Request, res: Response) => {
    try {
      const supportRequestId = req.params.id;
      const { status } = req.body;
      if (!status) {
        errorResponse(
          res,
          httpReasonCodes.NOT_FOUND,
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }

      const findSupportRequest = await prisma.supportRequests.findUnique({
        where: {
          id: supportRequestId,
        },
      });
      if (!findSupportRequest) {
        errorResponse(
          res,
          httpReasonCodes.NOT_FOUND,
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }

      const updateStatus = await prisma.supportRequests.update({
        where: { id: supportRequestId },
        data: {
          status,
          updated_at: new Date(),
        },
      });

      successResponse(res, 'Cập nhật status thành công', updateStatus);
    } catch (error: any) {
      errorResponse(
        res,
        error.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  sendMailAdmin: async (req: Request, res: Response) => {
    try {
      const { email, priority, category, content, title, created_at } =
        req.body;
      const mailAdmin = process.env.EMAIL_ADMIN as string;
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

      console.log('USER', user);
      // Đọc template HTML
      const pathhtml = path.resolve(__dirname, '../html/notify-admin.html');
      if (!fs.existsSync(pathhtml)) {
        throw new Error('File HTML không tồn tại');
      }
      let htmlContent = fs.readFileSync(pathhtml, 'utf-8');
      htmlContent = htmlContent
        .replace('{{title}}', title)
        .replace('{{category}}', category)
        .replace('{{content}}', content)
        .replace('{{NAME}}', user.username || 'Người dùng')
        .replace('{{USER_EMAIL}}', user.email)
        .replace('{{USER_PHONE}}', user.phone ?? 'Không có')
        .replace('{{CREATED_AT}}', created_at)
        .replace(
          '{{priority}}',
          priority ? priority.toLocaleString('vi-VN') : '',
        );

      // Lưu log email
      await prisma.emailLog.create({
        data: {
          user_id: user?.id,
          to: mailAdmin,
          subject: 'AKAds Thông Báo',
          body: htmlContent,
          status: 'success',
          type: 'notify support requests',
        },
      });

      // Gửi email
      await sendEmailFromUser({
        email: user.email,
        subject: 'AKAds Thông Báo',
        message: htmlContent,
      });

      successResponse(res, 'Email thông báo cho admin đã được gửi', {});
    } catch (error: any) {
      errorResponse(
        res,
        error.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  sendMailUser: async (req: Request, res: Response) => {
    try {
      const { title, status, updated_at, name, email, phone } = req.body;
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

      // Đọc template HTML
      const pathhtml = path.resolve(__dirname, '../html/notify-user.html');
      if (!fs.existsSync(pathhtml)) {
        throw new Error('File HTML không tồn tại');
      }
      let htmlContent = fs.readFileSync(pathhtml, 'utf-8');
      htmlContent = htmlContent
        .replace('{{title}}', title)
        .replace('{{status}}', status)
        .replace('{{updated_at}}', updated_at)
        .replace('{{name}}', name)
        .replace('{{email}}', email)
        .replace('{{phone}}', phone);

      // Lưu log email
      await prisma.emailLog.create({
        data: {
          user_id: user?.id,
          to: user.email,
          subject: 'AKAds Thông Báo',
          body: htmlContent,
          status: 'success',
          type: 'notify support requests',
        },
      });

      // Gửi email
      await sendEmail({
        email: user.email,
        subject: 'AKAds Thông Báo',
        message: htmlContent,
      });

      successResponse(res, 'Email thông báo cho admin đã được gửi', {});
    } catch (error: any) {
      errorResponse(
        res,
        error.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
};

export default supportController;
