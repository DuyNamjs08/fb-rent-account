import { Request, Response } from 'express';
import { errorResponse, successResponse } from '../helpers/response';
import { httpStatusCodes } from '../helpers/statusCodes';
import { httpReasonCodes } from '../helpers/reasonPhrases';
import prisma from '../config/prisma';
import { uploadToR2 } from '../middlewares/upload.middleware';
import { z } from 'zod';
import path from 'path';
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
  },
  // load more, search, filter
  getAllSupport: async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = '1',
        limit = '3',
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
          { title: { contains: search as string, mode: 'insensitive' } },
          { content: { contains: search as string, mode: 'insensitive' } },
          { fullName: { contains: search as string, mode: 'insensitive' } },
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
};

export default supportController;
