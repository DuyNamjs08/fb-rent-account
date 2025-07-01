import Bull from 'bull';
import prisma from '../config/prisma';
// import { getIO } from '..';

export const fbRealtimeTransaction = new Bull('fbRealtimeTransaction', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380', 10),
    password: process.env.REDIS_PASSWORD,
  },
  limiter: {
    max: 50, // tối đa 50 job
    duration: 1000, // mỗi 1000ms
  },
});

const updateDb = async (data: any) => {
  const {
    short_code,
    amountVND,
    transactionID,
    description,
    bank,
    type,
    date,
    usd,
    net_usd,
  } = data;
  const amountVNDchange = Math.floor(Number(amountVND));
  try {
    let transactionExist: any = {};
    if (bank == 'visa') {
      transactionExist = await prisma.$transaction(async (tx) => {
        const oldTransaction = await tx.transaction.findUnique({
          where: { short_code },
        });
        if (!oldTransaction) throw new Error('Transaction Không tồn tại!');
        await tx.user.update({
          where: { id: oldTransaction.user_id },
          data: {
            amount_usd: { increment: net_usd },
          },
        });
        const transaction = await tx.transaction.update({
          where: {
            id: oldTransaction.id,
          },
          data: {
            short_code: short_code,
            amountVND: 0,
            points: 0,
            usd,
            net_usd,
            transactionID,
            description,
            bank,
            type,
            date,
            status: 'success',
            user_id: oldTransaction.user_id,
          },
        });
        return transaction;
      });
    } else {
      transactionExist = await prisma.$transaction(async (tx) => {
        const oldTransaction = await tx.transaction.findUnique({
          where: { short_code },
        });
        if (!oldTransaction) throw new Error('Transaction Không tồn tại!');
        const user = await tx.user.update({
          where: { id: oldTransaction.user_id },
          data: {
            points: { increment: amountVNDchange },
          },
        });
        const transaction = await tx.transaction.update({
          where: {
            id: oldTransaction.id,
          },
          data: {
            short_code: short_code,
            amountVND: amountVNDchange,
            points: amountVNDchange,
            transactionID,
            description,
            bank,
            type,
            date,
            status: 'success',
            user_id: oldTransaction.user_id,
          },
        });
        return transaction;
      });
    }
    return transactionExist;
  } catch (error) {
    try {
      const fallbackTransaction = await prisma.transaction.update({
        where: {
          short_code: short_code,
        },
        data: {
          short_code,
          amountVND: amountVNDchange,
          points: 0,
          usd,
          net_usd,
          transactionID,
          description,
          bank,
          type,
          date,
          status: 'error',
          error_message: (error as Error).message,
        },
      });
      return fallbackTransaction;
    } catch (fallbackError) {
      console.error('❌ Lỗi khi ghi transaction lỗi:', fallbackError);
      // nếu vẫn lỗi, throw lỗi gốc để job biết
      throw fallbackError;
    }
  }
};
fbRealtimeTransaction.process(15, async (job) => {
  const { data } = job;
  try {
    const { amountVND } = data;
    console.log('data transaction', data);
    const res = await updateDb(data);
    // if (res.status == 'success') {
    //   console.log('socket emit', res);
    //   await getIO()
    //     .to(`user:${res.user_id}`)
    //     .emit('payment_success', { amount: amountVND });
    // }
    console.log(`✅ Cập nhật thành công transaction: ${res?.short_code}`);
    return res;
  } catch (err) {
    console.error(`❌ Lỗi khi cập nhật transaction`, err);
    throw err;
  }
});
