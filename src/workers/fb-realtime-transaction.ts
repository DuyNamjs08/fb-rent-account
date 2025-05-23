import Bull from 'bull';
import prisma from '../config/prisma';

export const fbRealtimeTransaction = new Bull('fbRealtimeTransaction', {
  redis: { port: 6380, host: 'localhost' },
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
  } = data;
  const amountVNDchange = Math.floor(Number(amountVND));
  try {
    const transactionExist = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { short_code },
      });
      if (!user) throw new Error('User Không tồn tại!');
      await tx.user.update({
        where: { short_code: short_code },
        data: {
          points: { increment: amountVNDchange },
        },
      });
      const transaction = await tx.transaction.create({
        data: {
          short_code: short_code,
          amountVND: amountVNDchange,
          points: amountVNDchange,
          transactionID,
          description,
          bank,
          type,
          date,
        },
      });
      return transaction;
    });
    return transactionExist;
  } catch (error) {
    console.error('Transaction error:', error);
    throw error;
  }
};
fbRealtimeTransaction.process(15, async (job) => {
  const { data } = job;
  try {
    console.log('data transaction', data);
    const res = await updateDb(data);
    console.log(`✅ Cập nhật thành công transaction: ${res?.short_code}`);
    return res;
  } catch (err) {
    console.error(`❌ Lỗi khi cập nhật transaction`, err);
    throw err;
  }
});
