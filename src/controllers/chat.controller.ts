import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../helpers/response';
import { httpReasonCodes } from '../helpers/reasonPhrases';
import { httpStatusCodes } from '../helpers/statusCodes';
import prisma from '../config/prisma';
import { getIO } from '../config/socket';
const ChatController = {
  createChat: async (req: Request, res: Response): Promise<void> => {
    try {
      const { user_id, content, chat_id } = req.body;
      if (chat_id) {
        const existingChat = await prisma.chat.findFirst({
          where: {
            id: chat_id,
            is_group: false,
          },
          include: { members: true },
        });
        if (!existingChat) {
          errorResponse(
            res,
            httpReasonCodes.NOT_FOUND,
            'Không tìm thấy cuộc trò chuyện',
            httpStatusCodes.NOT_FOUND,
          );
          return;
        }
        const message = await prisma.message.create({
          data: {
            content,
            chat: { connect: { id: existingChat.id } },
            sender: { connect: { id: user_id } },
          },
        });
        const io = getIO();
        existingChat.members.forEach((member) => {
          io.to(`user:${member.user_id}`).emit('new_message', {
            chat_id: existingChat.id,
            message,
          });
        });
        successResponse(res, 'Success', message);
        return;
      }
      const systemUser = await prisma.user.findFirst({
        where: {
          role: 'admin',
          email: 'admin@gmail.com',
        },
      });
      if (!systemUser) {
        errorResponse(
          res,
          httpReasonCodes.NOT_FOUND,
          'Không tìm thấy người dùng hệ thống',
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }
      const existingChat = await prisma.chat.findFirst({
        where: {
          is_group: false,
          members: {
            every: {
              user_id: { in: [user_id, systemUser.id] },
            },
          },
        },
        include: { members: true },
      });
      if (existingChat) {
        const message = await prisma.message.create({
          data: {
            content,
            chat: { connect: { id: existingChat.id } },
            sender: { connect: { id: user_id } },
          },
        });
        const io = getIO();
        existingChat.members.forEach((member) => {
          io.to(`user:${member.user_id}`).emit('new_message', {
            chat_id: existingChat.id,
            message,
          });
        });
        successResponse(res, 'Success', message);
        return;
      }
      const newChat = await prisma.chat.create({
        data: {
          is_group: false,
          members: {
            create: [{ user_id: user_id }, { user_id: systemUser.id }],
          },
        },
        include: { members: true },
      });
      const message = await prisma.message.create({
        data: {
          content,
          chat: { connect: { id: newChat.id } },
          sender: { connect: { id: user_id } },
        },
      });
      const io = getIO();
      newChat.members.forEach((member) => {
        io.to(`user:${member.user_id}`).emit('new_message', {
          chat_id: newChat.id,
          message,
        });
      });
      successResponse(res, 'Success', message);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  getAllChatMessageByUserId: async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const { user_id, chat_id } = req.query;
      const findUser = await prisma.user.findUnique({
        where: { id: user_id as string },
      });
      if (!chat_id) {
        const userChats = await prisma.chat.findMany({
          where: {
            members: {
              some: {
                user_id: user_id as string,
              },
            },
          },
        });
        if (!userChats || userChats.length === 0) {
          errorResponse(
            res,
            httpReasonCodes.NOT_FOUND,
            req.t('invalid_data'),
            httpStatusCodes.NOT_FOUND,
          );
          return;
        }
        const listLatestMessages = await prisma.message.findMany({
          where: {
            chat_id: chat_id as string,
          },
          // orderBy: {
          //   created_at: 'desc',
          // },
        });
        successResponse(res, 'List chat message', listLatestMessages);
        return;
      }

      const findChat = await prisma.chat.findUnique({
        where: { id: chat_id as string },
      });
      if (!findUser || !findChat) {
        errorResponse(
          res,
          httpReasonCodes.NOT_FOUND,
          req.t('invalid_data'),
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }
      const listLatestMessages = await prisma.message.findMany({
        where: {
          chat_id: chat_id as string,
        },
        // include: {
        //   sender: true,
        // },
        // orderBy: {
        //   created_at: 'desc',
        // },
      });

      successResponse(res, 'List chat message', listLatestMessages);
    } catch (error: any) {
      errorResponse(
        res,
        error?.message,
        error,
        httpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
  getAllChatByUserId: async (req: Request, res: Response): Promise<void> => {
    try {
      const { user_id } = req.query;
      const findUser = await prisma.user.findUnique({
        where: { id: user_id as string },
      });

      if (!findUser) {
        errorResponse(
          res,
          httpReasonCodes.NOT_FOUND,
          req.t('invalid_data'),
          httpStatusCodes.NOT_FOUND,
        );
        return;
      }
      const chats = await prisma.chat.findMany({
        where: {
          members: {
            some: {
              user_id: user_id as string, // lọc các chat mà user_id là thành viên
            },
          },
        },
        // include: {
        //   members: {
        //     include: {
        //       user: true, // nếu bạn cần thông tin user trong từng member
        //     },
        //   },
        //   messages: {
        //     orderBy: { created_at: 'desc' },
        //     take: 1, // nếu bạn muốn lấy message mới nhất của mỗi chat
        //     include: {
        //       sender: true,
        //     },
        //   },
        // },
        orderBy: {
          updated_at: 'desc', // sắp xếp theo cập nhật gần nhất (nếu dùng để hiển thị danh sách chat)
        },
      });

      successResponse(res, 'List chat');
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

export default ChatController;
