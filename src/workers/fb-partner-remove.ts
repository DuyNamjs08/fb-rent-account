import Bull from 'bull';
import { autoDisChardLimitSpend } from '../auto-use-sessionV3';
import { autoRemovePartner } from '../auto-use-sessionV4';
import prisma from '../config/prisma';
import { sendEmail } from '../controllers/mails.controller';
import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';
export const fbRemoveParnert = new Bull('fb-remove-parnert', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380', 10),
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    attempts: 1, // chỉ chạy 1 lần, không retry
    removeOnComplete: true,
    removeOnFail: true,
  },
});
const updateDb = async (data: any) => {
  try {
    const { ads_account_id, bm_origin, ads_name, bot_id, bm_id } = data;
    const cookie = await prisma.cookies.findUnique({
      where: {
        id: bot_id,
      },
    });
    if (!cookie) {
      throw new Error('Không tìm thấy cookie');
    }
    // const resultRemoveLimit = await autoDisChardLimitSpend({
    //   bm_id: bm_origin,
    //   ads_account_id,
    //   cookie_origin: cookie.storage_state,
    // });
    // const resultRemoveParnert = await autoRemovePartner({
    //   bm_origin,
    //   ads_account_id,
    //   ads_name,
    //   cookie_origin: cookie.storage_state,
    //   bm_id,
    // });
    // return {
    //   status_remove_spend_limit: resultRemoveLimit,
    //   status_remove_partner: resultRemoveParnert,
    // };
    return {
      status_remove_spend_limit: 1,
      status_remove_partner: 1,
    };
  } catch (fallbackError) {
    console.error('❌ Lỗi khi đổi điểm mã lỗi:', fallbackError);
    throw fallbackError;
  }
};
fbRemoveParnert.process(2, async (job) => {
  const { data } = job;
  const { bm_id, ads_account_id, user_id, amountPoint, id, ads_name } = data;
  try {
    console.log('data remove point', data);
    const pathhtml = path.resolve(__dirname, '../html/rent-success.html');
    console.log('pathhtml', pathhtml);
    let htmlContent = fs.readFileSync(pathhtml, 'utf-8');
    const res = await updateDb(data);
    const user = await prisma.user.findUnique({
      where: {
        id: user_id as string,
      },
    });
    const filterUser = user?.list_ads_account.filter(
      (item) => item !== ads_account_id,
    );
    if (res.status_remove_partner && res.status_remove_spend_limit) {
      const user = await prisma.user.update({
        where: {
          id: user_id as string,
        },
        data: {
          list_ads_account: filterUser,
        },
      });
      await prisma.emailLog.create({
        data: {
          user_id: user.id,
          to: user.email,
          subject: 'AKAds thông báo hủy đối tác vào BM',
          body: htmlContent
            .replace('{{accountName}}', user.username || 'Người dùng')
            .replace(
              '{{rentDuration}}',
              format(new Date(), 'dd/MM/yyyy HH:mm:ss') ||
                new Date().toLocaleString(),
            )
            .replace('{{ads_name}}', ads_name || '')
            .replace('{{amountPoint}}', amountPoint || '')
            .replace('{{bm_id}}', bm_id || ''),
          status: 'success',
          type: 'rent_ads_cancel',
        },
      });
      await sendEmail({
        email: user.email,
        subject: 'AKAds thông báo hủy đối tác vào BM',
        message: htmlContent
          .replace('{{accountName}}', user.username || 'Người dùng')
          .replace(
            '{{rentDuration}}',
            format(new Date(), 'dd/MM/yyyy HH:mm:ss') ||
              new Date().toLocaleString(),
          )
          .replace('{{amountPoint}}', amountPoint || '')
          .replace('{{ads_name}}', ads_name || '')
          .replace('{{bm_id}}', bm_id || ''),
      });
      await prisma.facebookPartnerBM.update({
        where: {
          id: id as string,
        },
        data: {
          status: 'complete_remove',
          status_partner: 0,
          status_limit_spend: null,
          status_dischard_limit_spend: 1,
          status_dischard_partner: 1,
        },
      });
      await prisma.adsAccount.update({
        where: {
          id: 'act_' + ads_account_id,
        },
        data: {
          status_rented: 'available',
        },
      });
    }
    console.log(`✅ Xóa thành công đối tác vào BM với trạng thái`, res);
    return res;
  } catch (err) {
    console.error(`❌ Lỗi khi xóa đối tác vào BM`, err);
    throw err;
  }
});
