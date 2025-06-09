import compression from 'compression';
import express from 'express';
import { Request, Response, Application } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger/swaggerConfig';
import * as dotenv from 'dotenv';
import cors from 'cors';
import RolesRoutes from './routes/roles.routes';
import UserRoutes from './routes/user.routes';
import TokenRoutes from './routes/token.route';
import adRoutes from './routes/tkqc.routes';
import transactionRoutes from './routes/transaction.routes';
import pointusedRoutes from './routes/poitused.routes';
import facebookBmRoutes from './routes/facebookBm.routes';
import cookieBmRoutes from './routes/cookie.routes';
import statisticsBmRoutes from './routes/statistics.routes';
import redisClient from './config/redis-config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { fbRealtimeTransaction } from './workers/fb-realtime-transaction';
import jwt, { JwtPayload } from 'jsonwebtoken';
import prisma from './config/prisma';

dotenv.config({ path: `${__dirname}/../.env` });
const envPath = `${__dirname}/../.env`;
const app: Application = express();
const server = createServer(app);
app.use(
  cors({
    origin: '*',
  }),
);
app.use(express.json());
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  adapter: createAdapter(redisClient, redisClient.duplicate()),
});
export function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
}
app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      return compression.filter(req, res);
    },
  }),
);
(async () => {
  try {
    await redisClient.set('test_key', 'hello');
    const value = await redisClient.get('test_key');
    console.log('Redis test value:', value);
  } catch (err) {
    console.error('Redis operation failed:', err);
  }
})();
app.use('/api/v1/', adRoutes);
app.use('/api/v1/', UserRoutes);
app.use('/api/v1/', TokenRoutes);
app.use('/api/v1/', RolesRoutes);
app.use('/api/v1/', transactionRoutes);
app.use('/api/v1/', pointusedRoutes);
app.use('/api/v1/', facebookBmRoutes);
app.use('/api/v1/', cookieBmRoutes);
app.use('/api/v1/', statisticsBmRoutes);

app.get('/', (req: Request, res: Response): void => {
  console.log(`Worker ${process.pid} is processing request`);
  res.send(`Worker tkqc ${process.pid} is handling this request`);
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
const VALID_TOKEN_WEB2M = process.env['VALID_TOKEN_WEB2M'];
app.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res
        .status(401)
        .send('Access Token không được cung cấp hoặc không hợp lệ.');
      return;
    }
    const token = authHeader.slice(7);
    if (!token || token !== VALID_TOKEN_WEB2M) {
      res.status(401).send('Chữ ký không hợp lệ.');
      return;
    }
    console.log('Received webhook data:', req.body);
    const data = req.body.data;
    if (!Array.isArray(data)) {
      res.status(400).json({ status: false, msg: 'Invalid payload format' });
      return;
    }
    function getUserIdFromTransaction(description: string) {
      const match = description.match(/NAP\d{8}/);
      return match ? match[0] : undefined;
    }
    for (const item of data) {
      const jobData = {
        short_code: getUserIdFromTransaction(item.description),
        amountVND: item.amount,
        transactionID: Number(item.transactionID) || 0,
        description: item.description,
        bank: item.bank,
        type: item.type,
        date: item.date,
      };
      await fbRealtimeTransaction.add(jobData, {
        removeOnComplete: true,
        removeOnFail: true,
      });
      const transaction = await prisma.transaction.findUnique({
        where: {
          short_code: getUserIdFromTransaction(item.description)
            ? getUserIdFromTransaction(item.description)
            : '',
        },
      });
      await getIO().to(`user:${transaction?.user_id}`).emit('payment_success', {
        amount: item.amount,
        message: 'Nạp tiền thành công chờ trong giây lát để cộng điểm!!',
      });
    }

    res.json({ status: true, msg: 'Ok' });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).send('Internal Server Error');
  }
});
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('No token provided'));
  try {
    const tokenSecret = process.env.ACCESS_TOKEN_SECRET || '';
    const payload = jwt.verify(token, tokenSecret) as JwtPayload;
    socket.data.userId = payload?.user_id || ''; // gắn userId vào socket
    next();
  } catch (err) {
    console.log('lỗi socket');
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
server.listen(4000, () =>
  console.log(`Worker ${process.pid} started on port ${4000}`),
);
