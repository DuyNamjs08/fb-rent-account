import Bull from 'bull';
import prisma from '../config/prisma';
import { autoChangePartner } from '../auto-use-session';
import { autoChangeLimitSpend } from '../auto-use-sessionV2';

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
    const { bm_id, ads_account_id, amountPoint, bm_origin, ads_name } = data;
    const result = await autoChangePartner({
      bm_id,
      ads_account_id,
      bm_origin,
      ads_name,
    });
    const resultChangeLimit = await autoChangeLimitSpend({
      bm_id: bm_origin,
      ads_account_id,
      amountPoint,
    });
    console.log('playwright res', {
      status_limit_spend: result,
      status_partner: resultChangeLimit,
    });
    return { status_limit_spend: resultChangeLimit, status_partner: result };
  } catch (fallbackError) {
    console.error('❌ Lỗi khi đổi điểm mã lỗi:', fallbackError);
    throw fallbackError;
  }
};
fbParnert.process(15, async (job) => {
  const { data } = job;
  const { bm_id, ads_account_id, user_id, amountPoint, bm_origin } = data;
  try {
    console.log('data used point', data);
    const res = await updateDb(data);
    const { status_partner, status_limit_spend } = res;
    await prisma.facebookPartnerBM.create({
      data: {
        bm_id: bm_id as string,
        ads_account_id,
        user_id,
        status: status_partner ? 'success' : 'faild',
        status_partner,
        status_limit_spend,
        bm_origin,
      },
    });
    if (status_partner && status_limit_spend) {
      await prisma.adsAccount.update({
        where: {
          id: 'act_' + ads_account_id,
        },
        data: {
          status_rented: 'available',
          spend_limit: amountPoint,
          note_aka: '',
        },
      });
      const user = await prisma.user.findUnique({
        where: { id: user_id },
        select: { list_ads_account: true },
      });
      if (!user) throw new Error('User not found');
      const currentList = user.list_ads_account || [];
      const updatedList = currentList.includes(ads_account_id)
        ? currentList
        : [...currentList, ads_account_id];
      await prisma.user.update({
        where: {
          id: user_id,
        },
        data: {
          list_ads_account: updatedList,
        },
      });
    }
    console.log(`✅ Cập nhật thành công đối tác vào BM với trạng thái`, res);
    return res;
  } catch (err) {
    console.error(`❌ Lỗi khi cập nhật đối tác vào BM`, err);
    throw err;
  }
});
