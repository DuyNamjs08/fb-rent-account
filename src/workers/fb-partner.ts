import Bull from 'bull';
import prisma from '../config/prisma';
import { autoChangePartner } from '../auto-use-session';
import { autoChangeLimitSpend } from '../auto-use-sessionV2';
import { createRepeatJob } from './fb-check-account';
import { sendEmail } from '../controllers/mails.controller';
import { format } from 'date-fns';

export const fbParnert = new Bull('fb-add-parnert-ads', {
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
    // const result = await autoChangePartner({
    //   bm_id,
    //   ads_account_id,
    //   bm_origin,
    //   ads_name,
    //   cookie_origin: cookie.storage_state,
    // });
    // const resultChangeLimit = await autoChangeLimitSpend({
    //   bm_id: bm_origin,
    //   ads_account_id,
    //   amountPoint,
    //   cookie_origin: cookie.storage_state,
    // });
    // console.log('playwright res', {
    //   status_limit_spend: result,
    //   status_partner: resultChangeLimit,
    // });
    // return { status_limit_spend: resultChangeLimit, status_partner: result };
    return { status_limit_spend: 1, status_partner: 1 };
  } catch (fallbackError) {
    console.error('❌ Lỗi khi đổi điểm mã lỗi:', fallbackError);
    throw fallbackError;
  }
};
fbParnert.process(2, async (job) => {
  const { data } = job;
  const {
    ads_account_id,
    user_id,
    amountPoint,
    id_partner,
    ads_name,
    bm_id,
    amountOrigin,
    currency,
    renderedHtmlSuccess,
    renderedHtmlError,
    titlEmailSucces,
    titlEmailError,
  } = data;
  try {
    console.log('data used point', data);
    const res = await updateDb(data);
    const { status_partner, status_limit_spend } = res;

    if (status_partner && status_limit_spend) {
      const userRentAds = await prisma.facebookPartnerBM.update({
        where: {
          id: id_partner,
        },
        data: {
          status: 'success',
          status_partner,
          status_limit_spend,
        },
      });
      await createRepeatJob({ ...data });
      await prisma.adsAccount.update({
        where: {
          id: 'act_' + ads_account_id,
        },
        data: {
          status_rented: 'rented',
          spend_limit: amountPoint,
          note_aka: '',
        },
      });
      const user = await prisma.user.findUnique({
        where: { id: user_id },
        // select: { list_ads_account: true, email: true },
      });

      if (!user) throw new Error('User not found');
      await prisma.notification.create({
        data: {
          user_id: user_id,
          title: 'Thông báo tài khoản đã thuê',
          content: `Quý khách đã thuê tài khoản: ${ads_name} thành công`,
          type: 'ads_success',
        },
      });
      await prisma.emailLog.create({
        data: {
          user_id: user.id,
          to: user.email,
          subject: titlEmailSucces,
          body: renderedHtmlSuccess,
          status: 'success',
          type: 'rent_ads',
        },
      });
      await sendEmail({
        email: user.email,
        subject: titlEmailSucces,
        message: renderedHtmlSuccess,
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
      const user = await prisma.user.findUnique({
        where: { id: user_id },
      });
      if (!user) throw new Error('User not found');
      await prisma.notification.create({
        data: {
          user_id: user_id,
          title: 'Thông báo tài khoản đã thuê',
          content: `Quý khách đã thuê tài khoản: ${ads_name} thất bại`,
          type: 'ads_faild',
        },
      });
      const userRentAds = await prisma.facebookPartnerBM.update({
        where: {
          id: id_partner,
        },
        data: {
          status: 'faild',
          status_partner,
          status_limit_spend,
        },
      });
      let errorMessage = 'Lỗi không xác định';
      if (status_partner == 0) {
        errorMessage = 'Lỗi khi thêm đối tác vào BM';
      } else if (status_limit_spend == 0) {
        errorMessage = 'Lỗi khi đặt giới hạn chi tiêu cho tài khoản quảng cáo';
      }
      await prisma.emailLog.create({
        data: {
          user_id: user.id,
          to: user.email,
          subject: titlEmailError,
          body: renderedHtmlError,
          status: 'success',
          type: 'rent_ads',
        },
      });
      await sendEmail({
        email: user.email,
        subject: titlEmailError,
        message: renderedHtmlError,
      });
      await prisma.$transaction(async (tx) => {
        const adsAccount = await tx.adsAccount.findFirst({
          where: {
            account_id: ads_account_id,
          },
        });
        if (!adsAccount) throw new Error('Tài khoản qc Không tồn tại!');
        if (currency == 'usd') {
          await tx.user.update({
            where: { id: user_id },
            data: {
              amount_usd: { increment: amountOrigin },
            },
          });
        } else {
          await tx.user.update({
            where: { id: user_id },
            data: {
              points: { increment: amountOrigin },
            },
          });
        }
        const pointsUsed = await tx.pointUsage.create({
          data: {
            user_id,
            points_used: amountOrigin,
            target_account: ads_account_id,
            description: 'Hoàn điểm tài khoản quảng cáo',
            status: 'success',
            currency,
          },
        });
        return pointsUsed;
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
