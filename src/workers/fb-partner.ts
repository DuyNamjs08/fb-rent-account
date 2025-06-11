import Bull from 'bull';
import prisma from '../config/prisma';
import { autoChangePartner } from '../auto-use-session';
import { autoChangeLimitSpend } from '../auto-use-sessionV2';
import { createRepeatJob } from './fb-check-account';
import fs from 'fs';
import path from 'path';
import { sendEmail } from '../controllers/mails.controller';
import { format } from 'date-fns';

export const fbParnert = new Bull('fb-add-parnert-ads', {
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
    const { bm_id, ads_account_id, amountPoint, bm_origin, ads_name, bot_id } =
      data;
    const cookie = await prisma.cookies.findUnique({
      where: {
        id: bot_id,
      },
    });
    if (!cookie) {
      throw new Error('Không tìm thấy cookie');
    }
    const result = await autoChangePartner({
      bm_id,
      ads_account_id,
      bm_origin,
      ads_name,
      cookie_origin: cookie.storage_state,
    });
    const resultChangeLimit = await autoChangeLimitSpend({
      bm_id: bm_origin,
      ads_account_id,
      amountPoint,
      cookie_origin: cookie.storage_state,
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
  const { ads_account_id, user_id, amountPoint, id_partner, ads_name, bm_id } =
    data;
  try {
    console.log('data used point', data);
    const pathhtml = path.resolve(__dirname, '../html/rent-success.html');
    console.log('pathhtml', pathhtml);
    let htmlContent = fs.readFileSync(pathhtml, 'utf-8');
    const res = await updateDb(data);
    const { status_partner, status_limit_spend } = res;
    const userRentAds = await prisma.facebookPartnerBM.update({
      where: {
        id: id_partner,
      },
      data: {
        status: status_partner ? 'success' : 'faild',
        status_partner,
        status_limit_spend,
      },
    });
    if (status_partner && status_limit_spend) {
      await createRepeatJob({ ...data });
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
        // select: { list_ads_account: true, email: true },
      });

      if (!user) throw new Error('User not found');
      await prisma.emailLog.create({
        data: {
          user_id: user.id,
          to: user.email,
          subject: 'AKAds thông báo đăng nhập',
          body: htmlContent
            .replace('{{accountName}}', user.username || 'Người dùng')
            .replace(
              '{{rentDuration}}',
              format(new Date(userRentAds.created_at), 'dd/MM/yyyy HH:mm:ss') ||
                new Date().toLocaleString(),
            )
            .replace('{{ads_name}}', ads_name || '')
            .replace('{{amountPoint}}', amountPoint || '')
            .replace('{{bm_id}}', bm_id || ''),
          status: 'success',
          type: 'rent_ads',
        },
      });
      await sendEmail({
        email: user.email,
        subject: 'AKAds thông báo thêm tài khoản quảng cáo vào BM',
        message: htmlContent
          .replace('{{accountName}}', user.username || 'Người dùng')
          .replace(
            '{{rentDuration}}',
            format(new Date(userRentAds.created_at), 'dd/MM/yyyy HH:mm:ss') ||
              new Date().toLocaleString(),
          )
          .replace('{{ads_name}}', ads_name || '')
          .replace('{{amountPoint}}', amountPoint || '')
          .replace('{{bm_id}}', bm_id || ''),
      });
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
    return true;
  } catch (err) {
    console.error(`❌ Lỗi khi cập nhật đối tác vào BM`, err);
    throw err;
  }
});
fbParnert.on('failed', (job, err) => {
  console.error('Job failed', job.id, err);
});
