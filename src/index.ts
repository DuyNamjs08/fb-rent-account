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
import redisClient from './config/redis-config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { fbRealtimeTransaction } from './workers/fb-realtime-transaction';

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
app.use('/api/v1/', UserRoutes);
app.use('/api/v1/', TokenRoutes);
app.use('/api/v1/', RolesRoutes);

app.get('/', (req: Request, res: Response): void => {
  console.log(`Worker ${process.pid} is processing request`);
  res.send(`Worker tkqc ${process.pid} is handling this request`);
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
const VALID_TOKEN_WEB2M = process.env['VALID_TOKEN_WEB2M'];
app.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token || token !== VALID_TOKEN_WEB2M) {
      res.status(401).send('Unauthorized');
      return;
    }
    console.log('Received webhook data:', req.body);
    const data = req.body.data;
    if (!Array.isArray(data)) {
      res.status(400).json({ status: false, msg: 'Invalid payload format' });
      return;
    }
    function getUserIdFromTransaction(description: string) {
      const match = description.match(/NAP\d{4}/);
      return match ? match[0] : null;
    }
    for (const item of data) {
      const jobData = {
        short_code: getUserIdFromTransaction(item.description),
        amountVND: item.amount,
        transactionID: item.transactionID,
        description: item.description,
        bank: item.bank,
        type: item.type,
        date: item.date,
      };
      console.log('adđ', getUserIdFromTransaction(item.description));
      await fbRealtimeTransaction.add(jobData, {
        removeOnComplete: true,
        removeOnFail: true,
      });
    }
    res.status(200).json({ status: true, msg: 'Ok' });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).send('Internal Server Error');
  }
});
io.on('connection', (socket) => {
  console.log(`Client mới kết nối: ${socket.id}`);
  // Xử lý ngắt kết nối
  socket.on('disconnect', () => {
    console.log(`Client ngắt kết nối: ${socket.id}`);
  });
  socket.on('joinRoom', ({ userId, data }) => {
    socket.join(userId);
    console.log({
      userId,
      data,
    });
    console.log(`Socket ${socket.id} joined room ${userId}`);
  });
  socket.on('message', (data) => {
    console.log('Tin nhắn nhận được:', data);
    io.emit('message', data);
  });
});
server.listen(4001, () =>
  console.log(`Worker ${process.pid} started on port ${4001}`),
);
