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
import mustache from 'mustache';

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
          throw new Error(req.t('file_type_error'));
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

      successResponse(res, req.t('create_request_success'), supportRequest);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        errorResponse(
          res,
          req.t('invalid_input_data'),
          error.errors,
          httpStatusCodes.BAD_REQUEST,
        );
      } else if (
        error.message.includes('Unsupported file type') ||
        error.message.includes('valid image')
      ) {
        errorResponse(res, error.message, error, httpStatusCodes.BAD_REQUEST);
      } else if (error.message.includes('File too large')) {
        errorResponse(res, req.t('file_too_large'), error);
      } else {
        errorResponse(
          res,
          error?.message || req.t('support_creation_error'),
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

      // console.log('test123: ', req.t('usersupport.header_title'));

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

      successResponse(res, req.t('support_list'), {
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
      successResponse(res, req.t('support_list'), {
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
      successResponse(res, req.t('delete_success'), true);
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

      successResponse(res, req.t('message_created'), newMessage);
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

      successResponse(res, req.t('messages_retrieved'), message);
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

      successResponse(res, req.t('status_updated'), updateStatus);
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
      const lang = (req.headers['accept-language'] || 'vi')
        .split(',')[0]
        .split('-')[0]
        .trim();
      req.i18n?.changeLanguage(lang);

      const { email, priority, category, content, title, created_at } =
        req.body;
      const mailAdmin = process.env.EMAIL_ADMIN as string;
      const user = await UserService.getUserByEmail(email);
      if (!user) {
        errorResponse(
          res,
          req.t('account_not_exist'),
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }

      // console.log('USER', user);
      // Đọc template HTML
      const pathhtml = path.resolve(__dirname, '../html/notify-admin.html');
      if (!fs.existsSync(pathhtml)) {
        throw new Error(req.t('html_file_exist'));
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
      const renderedHtml = mustache.render(htmlContent, {
        // Biến động
        title: title,
        category: category,
        content: content,
        NAME: user.username || 'Người dùng',
        USER_EMAIL: user.email,
        USER_PHONE: user.phone ?? 'Không có',
        CREATED_AT: created_at,
        priority: priority ? priority.toLocaleString('vi-VN') : '',
        // i18n từ object
        header_title: req.t('adminsupport.header_title'),
        header_description: req.t('adminsupport.header_description'),
        field_title: req.t('adminsupport.field_title'),
        field_fullname: req.t('adminsupport.field_fullname'),
        field_email: req.t('adminsupport.field_email'),
        field_phone: req.t('adminsupport.field_phone'),
        field_priority: req.t('adminsupport.field_priority'),
        field_category: req.t('adminsupport.field_category'),
        field_created_at: req.t('adminsupport.field_created_at'),
        request_content: req.t('adminsupport.request_content'),
      });
      // Lưu log email
      await prisma.emailLog.create({
        data: {
          user_id: user?.id,
          to: mailAdmin,
          subject: req.t('adminsupport.akaNotify'),
          body: renderedHtml,
          status: 'success',
          type: 'notify support requests',
        },
      });

      // Gửi email
      await sendEmailFromUser({
        email: user.email,
        subject: req.t('adminsupport.akaNotify'),
        message: renderedHtml,
      });

      successResponse(res, req.t('admin_email_sent'), {});
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
      const lang = (req.headers['accept-language'] || 'vi')
        .split(',')[0]
        .split('-')[0]
        .trim();
      req.i18n?.changeLanguage(lang);

      const { title, status, updated_at, name, email, phone } = req.body;
      const user = await UserService.getUserByEmail(email);
      if (!user) {
        errorResponse(
          res,
          req.t('account_not_exist'),
          {},
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }

      // Đọc template HTML
      const pathhtml = path.resolve(__dirname, '../html/notify-user.html');
      if (!fs.existsSync(pathhtml)) {
        throw new Error(req.t('html_file_exist'));
      }
      let htmlContent = fs.readFileSync(pathhtml, 'utf-8');
      const renderedHtml = mustache.render(htmlContent, {
        // Biến động
        title: title,
        name: name,
        email: email,
        phone: phone,
        updated_at: updated_at,
        status: status,

        // i18n từ object usersupport
        header_title: req.t('usersupport.header_title'),
        header_subtitle: req.t('usersupport.header_subtitle'),
        label_title: req.t('usersupport.label_title'),
        label_name: req.t('usersupport.label_name'),
        label_email: req.t('usersupport.label_email'),
        label_phone: req.t('usersupport.label_phone'),
        label_updated_at: req.t('usersupport.label_updated_at'),
        label_status: req.t('usersupport.label_status'),

        need_help: req.t('usersupport.need_help'),
        hotline: req.t('usersupport.hotline'),
        support_email: req.t('usersupport.support_email'),
        working_hours: req.t('usersupport.working_hours'),
        working_days: req.t('usersupport.working_days'),

        company_name: req.t('usersupport.company_name'),
        auto_notice: req.t('usersupport.auto_notice'),
        company_address: req.t('usersupport.company_address'),
        website: req.t('usersupport.website'),
        rights_reserved: req.t('usersupport.rights_reserved'),
      });
      // Lưu log email
      await prisma.emailLog.create({
        data: {
          user_id: user?.id,
          to: user.email,
          subject: req.t('usersupport.header_noti'),
          body: renderedHtml,
          status: 'success',
          type: 'notify support requests',
        },
      });

      // Gửi email
      await sendEmail({
        email: user.email,
        subject: req.t('usersupport.header_noti'),
        message: renderedHtml,
      });

      successResponse(res, req.t('user_email_sent'), {});
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
