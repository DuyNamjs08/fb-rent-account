import Bull from 'bull';
import { autoDisChardLimitSpend } from '../auto-use-sessionV3';
import { autoRemovePartner } from '../auto-use-sessionV4';

export const fbRemoveParnert = new Bull('fbRemoveParnert', {
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
    const { bm_id, ads_account_id, amountPoint, bm_origin, ads_name } = data;
    const resultRemoveLimit = await autoDisChardLimitSpend({
      bm_id: bm_origin,
      ads_account_id,
    });
    const resultRemoveParnert = await autoRemovePartner({
      bm_origin,
      ads_account_id,
      ads_name,
    });
    return {
      status_remove_spend_limit: resultRemoveLimit,
      status_remove_partner: resultRemoveParnert,
    };
  } catch (fallbackError) {
    console.error('❌ Lỗi khi đổi điểm mã lỗi:', fallbackError);
    throw fallbackError;
  }
};
fbRemoveParnert.process(15, async (job) => {
  const { data } = job;
  const { bm_id, ads_account_id, user_id, amountPoint } = data;
  try {
    console.log('data remove point', data);
    const res = await updateDb(data);
    // const { status_remove_spend_limit, status_remove_partner } = res;
    console.log(`✅ Xóa thành công đối tác vào BM với trạng thái`, res);
    return res;
  } catch (err) {
    console.error(`❌ Lỗi khi xóa đối tác vào BM`, err);
    throw err;
  }
});
