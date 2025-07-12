// socket.ts
import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt, { JwtPayload } from 'jsonwebtoken';
import redisClient from './redis-config';

let io: Server | null = null;

export function initSocket(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    adapter: createAdapter(redisClient, redisClient.duplicate()),
  });

  // Middleware xác thực token
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('No token provided'));
    try {
      const tokenSecret = process.env.ACCESS_TOKEN_SECRET || '';
      const payload = jwt.verify(token, tokenSecret) as JwtPayload;
      socket.data.userId = payload?.user_id || '';
      next();
    } catch (err) {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Client mới kết nối: ${socket.id}`);
    socket.on('joinRoom', () => {
      const userId = socket.data.userId;
      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`Socket ${socket.id} joined room user:${userId}`);
      } else {
        console.warn(`Socket ${socket.id} missing userId`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client ngắt kết nối: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
}
