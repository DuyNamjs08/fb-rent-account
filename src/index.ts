import compression from 'compression';
import express from 'express';
import { Request, Response, Application } from 'express';
import FacebookRoutes from './routes/facebook.routes';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger/swaggerConfig';
import * as dotenv from 'dotenv';
import cors from 'cors';
import RolesRoutes from './routes/roles.routes';
import UserRoutes from './routes/user.routes';
import TokenRoutes from './routes/token.route';
import FacebookFanPageRoutes from './routes/facebookFanpage.route';
import FacebookConnection from './routes/facebookConnection.route';
import FacebookPageInsight from './routes/facebookPageInsight.route';
import uploadtestRoutes from './routes/test.routes';
import resourcesRoutes from './routes/resources.routes';
import FacebookPostRoutes from './routes/facebookPost.route';
import FacebookSchedualRoutes from './routes/facebookSchedual.route';
import OpenaiRoutes from './routes/openAi.routes';
import NotiRoutes from './routes/noti.routes';
import redisClient from './config/redis-config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';

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

app.use('/api/v1/', OpenaiRoutes);
app.use('/api/v1/', NotiRoutes);
app.use('/api/v1/', FacebookSchedualRoutes);
app.use('/api/v1/', FacebookPostRoutes);
app.use('/api/v1/', resourcesRoutes);
app.use('/api/v1/', uploadtestRoutes);
app.use('/api/v1/', FacebookConnection);
app.use('/api/v1/', FacebookPageInsight);
app.use('/api/v1/', FacebookFanPageRoutes);
app.use('/api/v1/', UserRoutes);
app.use('/api/v1/', TokenRoutes);
app.use('/api/v1/', FacebookRoutes);
app.use('/api/v1/', RolesRoutes);

app.get('/', (req: Request, res: Response): void => {
  console.log(`Worker ${process.pid} is processing request`);
  res.send(`Worker ${process.pid} is handling this request`);
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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
