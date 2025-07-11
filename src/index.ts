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
import policiesRoutes from './routes/policies.routes';
import budgetRoutes from './routes/budget.routes';
import notificationRoutes from './routes/notification.routes';
import testRoutes from './routes/test.routes';
import fbVisaRoutes from './routes/fbVisa.routes';
import voucherRoutes from './routes/voucher.routes';
import userVoucherRoutes from './routes/userVoucher.routes';
import configRoutes from './routes/config.routes';
import paypalRoutes from './routes/paypal.routes';
import chatRoutes from './routes/chat.routes';
import redisClient from './config/redis-config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { fbRealtimeTransaction } from './workers/fb-realtime-transaction';
import jwt, { JwtPayload } from 'jsonwebtoken';
import prisma from './config/prisma';
import './workers/fb-partner';
import './workers/fb-partner-remove';
import './workers/fb-check-account';
import './workers/fb-test';
import supportRoutes from './routes/support.routes';
import morgan from 'morgan';
import i18next from 'i18next';
import middleware from 'i18next-http-middleware';
import Backend from 'i18next-fs-backend';
import path from 'path';
import { setLanguageFromConfig } from './middlewares/setLanguageFromConfig';
import mustache from 'mustache';
import { sendEmail } from './controllers/mails.controller';
import fs from 'fs';
import { format } from 'date-fns';
import { getIO, initSocket } from './config/socket';

async function init() {
  dotenv.config({ path: `${__dirname}/../.env` });
  const envPath = `${__dirname}/../.env`;
  const app: Application = express();
  const server = createServer(app);

  await i18next
    .use(Backend)
    .use(middleware.LanguageDetector)
    .init({
      fallbackLng: 'vi',
      preload: ['en', 'vi'],
      backend: {
        loadPath: path.join(__dirname, `/locales/{{lng}}/translation.json`),
      },
    });

  app.use(middleware.handle(i18next));
  app.use(
    cors({
      origin: '*',
    }),
  );
  app.use(morgan('combined'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // const io = new Server(server, {
  //   cors: {
  //     origin: '*',
  //     methods: ['GET', 'POST'],
  //   },
  //   adapter: createAdapter(redisClient, redisClient.duplicate()),
  // });
  // function getIO() {
  //   if (!io) {
  //     throw new Error('Socket.io not initialized!');
  //   }
  //   return io;
  // }
  // io.use(async (socket, next) => {
  //   const token = socket.handshake.auth.token;
  //   if (!token) return next(new Error('No token provided'));
  //   try {
  //     const tokenSecret = process.env.ACCESS_TOKEN_SECRET || '';
  //     const payload = jwt.verify(token, tokenSecret) as JwtPayload;
  //     socket.data.userId = payload?.user_id || ''; // gắn userId vào socket
  //     next();
  //   } catch (err) {
  //     console.log('lỗi socket');
  //     next(new Error('Unauthorized'));
  //   }
  // });

  // io.on('connection', (socket) => {
  //   console.log(`Client mới kết nối: ${socket.id}`);
  //   socket.on('joinRoom', () => {
  //     const userId = socket.data.userId;
  //     if (userId) {
  //       socket.join(`user:${userId}`);
  //       console.log(`Socket ${socket.id} joined room user:${userId}`);
  //     } else {
  //       console.warn(`Socket ${socket.id} missing userId`);
  //     }
  //   });
  //   socket.on('disconnect', () => {
  //     console.log(`Client ngắt kết nối: ${socket.id}`);
  //   });
  // });
  const io = initSocket(server);

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
  // middlware set ngôn ngữ từ config-settings
  app.use(setLanguageFromConfig);
  // các đầu api
  app.get('/test-i18n', async (req, res) => {
    const pathhtml = path.resolve(__dirname, './html/rent-success.html');
    const pathhtmlError = path.resolve(__dirname, './html/rent-error.html');
    let htmlContentV2 = fs.readFileSync(pathhtmlError, 'utf-8');

    let htmlContent = fs.readFileSync(pathhtml, 'utf-8');
    const renderedHtml = mustache.render(htmlContentV2, {
      accountName: 'Duy Nam',
      rentDuration: format(new Date(), 'dd/MM/yyyy HH:mm:ss'),
      ads_name: 'test1',
      amountPoint: '30000',
      bm_id: '10001',
      errorMessage: 'Không thể connect được tới bm',
      // Truyền từng key đã dịch sẵn
      success_title: req.t('email.success_title'),
      failed_title: req.t('email.failed_title'),
      error_notice: req.t('email.error_notice'),
      error_detail: req.t('email.error_detail'),
      hello: req.t('email.hello'),
      rent_success_desc: req.t('email.rent_success_desc'),
      account_info: req.t('email.account_info'),
      account_name: req.t('email.account_name'),
      rent_duration: req.t('email.rent_duration'),
      start_time: req.t('email.start_time'),
      ads_name_text: req.t('email.ads_name'),
      bm_id_text: req.t('email.bm_id'),
      amount_point: req.t('email.amount_point'),
      activated: req.t('email.activated'),
      need_support: req.t('email.need_support'),
      support_desc: req.t('email.support_desc'),
      support_btn: req.t('email.support_btn'),
      regards: req.t('email.regards'),
      team_name: req.t('email.team_name'),
    });
    await sendEmail({
      email: 'duynam11a11999@gmail.com',
      subject: 'AKAds thông báo thêm tài khoản quảng cáo vào BM',
      message: renderedHtml,
    });
    const message = req.t('greeting');
    res.json({ message });
  });
  app.use('/api/v1/', adRoutes);
  app.use('/api/v1/', chatRoutes);
  app.use('/api/v1/', configRoutes);
  app.use('/api/v1/', UserRoutes);
  app.use('/api/v1/', TokenRoutes);
  app.use('/api/v1/', RolesRoutes);
  app.use('/api/v1/', transactionRoutes);
  app.use('/api/v1/', pointusedRoutes);
  app.use('/api/v1/', facebookBmRoutes);
  app.use('/api/v1/', cookieBmRoutes);
  app.use('/api/v1/', supportRoutes);
  app.use('/api/v1/', statisticsBmRoutes);
  app.use('/api/v1/', policiesRoutes);
  app.use('/api/v1/', budgetRoutes);
  app.use('/api/v1/', notificationRoutes);
  app.use('/api/v1/', testRoutes);
  app.use('/api/v1/', fbVisaRoutes);
  app.use('/api/v1/', voucherRoutes);
  app.use('/api/v1/', userVoucherRoutes);
  app.use('/', paypalRoutes);

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
        await getIO()
          .to(`user:${transaction?.user_id}`)
          .emit('payment_success', {
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

  server.listen(4000, () =>
    console.log(`Worker ${process.pid} started on port ${4000}`),
  );
}
init();
