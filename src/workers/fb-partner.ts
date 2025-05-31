import Bull from 'bull';
import prisma from '../config/prisma';
import { autoChangePartner } from '../auto-use-session';

export const fbParnert = new Bull('fbParnert', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380', 10),
    password: process.env.REDIS_PASSWORD,
  },
  limiter: {
    max: 50, // tối đa 50 job
    duration: 1000, // mỗi 1000ms
  },
  defaultJobOptions: {
    attempts: 1, // chỉ chạy 1 lần, không retry
    removeOnComplete: true,
    removeOnFail: true,
  },
});
const updateDb = async (data: any) => {
  try {
    const { bm_id, ads_account_id } = data;
    const result = await autoChangePartner({ bm_id, ads_account_id });
    return result;
  } catch (fallbackError) {
    console.error('❌ Lỗi khi đổi điểm mã lỗi:', fallbackError);
    throw fallbackError;
  }
};
fbParnert.process(15, async (job) => {
  const { data } = job;
  const { bm_id, ads_account_id, user_id } = data;
  try {
    console.log('data used point', data);
    const res = await updateDb(data);
    await prisma.facebookPartnerBM.create({
      data: {
        bm_id,
        ads_account_id,
        user_id,
        status: res ? 'success' : 'faild',
      },
    });
    console.log(`✅ Cập nhật thành công đối tác vào BM với trạng thái`, res);
    return res;
  } catch (err) {
    console.error(`❌ Lỗi khi cập nhật đối tác vào BM`, err);
    throw err;
  }
});
