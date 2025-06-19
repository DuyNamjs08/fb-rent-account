import Bull from 'bull';
import prisma from '../config/prisma';
import { autoChangePartner } from '../auto-use-session';
import fs from 'fs';
import path from 'path';
import { sendEmail } from '../controllers/mails.controller';
import { format } from 'date-fns';
import { autoChangeVisa } from '../auto-use-sessionV6';
import { createRepeatJobVisa } from './fb-check-visa';

export const fbParnertVisa = new Bull('fb-add-parnert-ads-visa', {
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
    const {
      bm_id,
      ads_account_id,
      amountPoint,
      bm_origin,
      ads_name,
      bot_id,
      visa_name,
      visa_number,
      visa_expiration,
      visa_cvv,
      verify_code,
    } = data;
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
    const resultChangeVisa = await autoChangeVisa({
      visa_name,
      visa_number,
      visa_expiration,
      visa_cvv,
      // Thêm các thông tin visa vào hàm autoChangeVisa
      bm_id: bm_origin,
      ads_account_id,
      amountPoint,
      cookie_origin: cookie.storage_state,
    });
    console.log('playwright res', {
      status_visa: result,
      status_partner: resultChangeVisa,
    });
    return { status_visa: resultChangeVisa, status_partner: result };
  } catch (fallbackError) {
    console.error('❌ Lỗi khi đổi điểm mã lỗi:', fallbackError);
    throw fallbackError;
  }
};
fbParnertVisa.process(2, async (job) => {
  const { data } = job;
  const { ads_account_id, user_id, amountPoint, id_partner, ads_name, bm_id } =
    data;
  try {
    console.log('data used point', data);
    const pathhtml = path.resolve(__dirname, '../html/rent-success.html');
    console.log('pathhtml', pathhtml);
    let htmlContent = fs.readFileSync(pathhtml, 'utf-8');
    const res = await updateDb(data);
    const { status_partner, status_visa } = res;
    const userRentAds = await prisma.facebookPartnerBM.update({
      where: {
        id: id_partner,
      },
      data: {
        status: status_partner ? 'success' : 'faild',
        status_partner,
        status_limit_spend: 0,
        is_sefl_used_visa: !!status_visa,
      },
    });
    const amountVNDchange = Math.floor(Number(amountPoint));
    if (status_partner && status_visa) {
      await createRepeatJobVisa({ ...data });
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
      });

      if (!user) throw new Error('User not found');
      await prisma.emailLog.create({
        data: {
          user_id: user.id,
          to: user.email,
          subject: 'AKAds thông báo thêm tài khoản quảng cáo vào BM bằng visa',
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
        subject: 'AKAds thông báo thêm tài khoản quảng cáo vào BM  bằng visa',
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
    } else {
      await prisma.$transaction(async (tx) => {
        const adsAccount = await tx.adsAccount.findFirst({
          where: {
            account_id: ads_account_id,
          },
        });
        if (!adsAccount) throw new Error('Tài khoản qc Không tồn tại!');
        await tx.user.update({
          where: { id: user_id },
          data: {
            points: { increment: amountVNDchange },
          },
        });
        const pointsUsed = await tx.pointUsage.create({
          data: {
            user_id,
            points_used: amountVNDchange,
            target_account: ads_account_id,
            description: 'Đổi điểm tài khoản quảng cáo',
            status: 'success',
          },
        });
        return pointsUsed;
      });
    }
    console.log(
      `✅ Cập nhật thành công đối tác vào BM với thẻ visa với trạng thái`,
      res,
    );
    return true;
  } catch (err) {
    console.error(`❌ Lỗi khi cập nhật đối tác vào BM bằng thẻ visa`, err);
    throw err;
  }
});
fbParnertVisa.on('failed', (job, err) => {
  console.error('Job failed', job.id, err);
});
