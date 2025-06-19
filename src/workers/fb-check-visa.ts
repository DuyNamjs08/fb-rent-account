import Bull from 'bull';
import prisma from '../config/prisma';
import { decryptToken } from '../controllers/facebookBm.controller';
import axios from 'axios';
import { differenceInDays, format, isAfter } from 'date-fns';
import fs from 'fs';
import path from 'path';
import { sendEmail } from '../controllers/mails.controller';
import { fbRemoveParnertVisa } from './fb-partner-remove-visa';

function isLessThan2DaysOld(end_date: string | Date): boolean {
  const now = new Date();
  const createdDate = new Date(end_date);

  const diffDays = differenceInDays(now, createdDate);

  return diffDays <= 2;
}

export const fbCheckAccountVisa = new Bull('fb-check-account-visa', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380', 10),
    password: process.env.REDIS_PASSWORD,
  },
  limiter: {
    max: 50,
    duration: 1000,
  },
  defaultJobOptions: {
    removeOnFail: true,
    removeOnComplete: true,
    attempts: 1,
  },
});

const updateDb = async (data: any) => {
  const {
    bm_id,
    ads_account_id,
    amountPoint,
    bm_origin,
    ads_name,
    bot_id,
    user_id,
    job,
  } = data;
  try {
    // console.log('data used point', data);
    const pathhtml = path.resolve(__dirname, '../html/rent-visa-expried.html');
    // console.log('pathhtml', pathhtml);
    let htmlContent = fs.readFileSync(pathhtml, 'utf-8');
    const systemUserToken = await prisma.facebookBM.findUnique({
      where: { bm_id: bm_origin },
    });
    if (!systemUserToken) {
      throw new Error('không tìm thấy bm id');
    }
    const systemUserDecode = await decryptToken(
      systemUserToken.system_user_token,
    );
    const fields = [
      'name',
      'account_id',
      'balance',
      'currency',
      'owner',
      'amount_spent',
      'spend_cap',
    ].join(',');

    const baseUrl = `https://graph.facebook.com/v17.0/act_${ads_account_id}`;
    const url = `${baseUrl}?fields=${fields}&limit=20&access_token=${systemUserDecode}`;

    const response = await axios.get(url);
    const result = response.data;
    const findBm = await prisma.facebookPartnerBM.findFirst({
      where: {
        ads_account_id,
        status_partner: 1,
        is_sefl_used_visa: true,
        status: 'success',
      },
    });
    if (!findBm) {
      throw new Error('Không tìm thấy BM đã thuê');
    }
    const statart_date = findBm?.start_date?.at(-1);
    const end_date = findBm?.end_date?.at(-1) || new Date();

    const todayVN = new Date();
    console.log('budget', findBm?.budget);
    console.log('spend_cap', result.spend_cap);
    console.log('isAfter(todayVN, end_date)', result.spend_cap);
    if (isLessThan2DaysOld(end_date) && !findBm?.is_email_sent) {
      const user = await prisma.user.findUnique({
        where: { id: user_id },
      });
      if (!user) {
        throw new Error('Người dùng không tồn tại');
      }
      await prisma.emailLog.create({
        data: {
          user_id,
          to: user.email,
          subject:
            'AKAds thông báo tài khoản quảng cáo thuê BM tự add thẻ visa sắp hết hạn',
          body: htmlContent
            .replace('{{accountName}}', user.username || 'Người dùng')
            .replace('{{accountNameV2}}', user.username || 'Người dùng')
            .replace(
              '{{statart_date}}',
              format(
                new Date(statart_date || new Date()),
                'dd/MM/yyyy HH:mm:ss',
              ) || new Date().toLocaleString(),
            )
            .replace(
              '{{end_date}}',
              format(new Date(end_date || new Date()), 'dd/MM/yyyy HH:mm:ss') ||
                new Date().toLocaleString(),
            )
            .replace('{{ads_name}}', ads_name || '')
            .replace('{{bm_id}}', bm_id || ''),
          status: 'success',
          type: 'rent_ads',
        },
      });
      await sendEmail({
        email: user.email,
        subject:
          'AKAds thông báo tài khoản quảng cáo thuê BM tự add thẻ visa sắp hết hạn',
        message: htmlContent
          .replace('{{accountName}}', user.username || 'Người dùng')
          .replace('{{accountNameV2}}', user.username || 'Người dùng')
          .replace(
            '{{statart_date}}',
            format(
              new Date(statart_date || new Date()),
              'dd/MM/yyyy HH:mm:ss',
            ) || new Date().toLocaleString(),
          )
          .replace(
            '{{end_date}}',
            format(new Date(end_date || new Date()), 'dd/MM/yyyy HH:mm:ss') ||
              new Date().toLocaleString(),
          )
          .replace('{{ads_name}}', ads_name || '')
          .replace('{{bm_id}}', bm_id || ''),
      });
      await prisma.facebookPartnerBM.update({
        where: { id: findBm.id as string },
        data: {
          is_email_sent: true,
        },
      });
    } else if (isAfter(todayVN, end_date)) {
      console.log('🛑 đã hết hạn gói xóa khỏi gói');
      await fbRemoveParnertVisa.add({
        ads_account_id,
        bm_origin,
        ads_name,
        bot_id,
        bm_id,
        id: findBm.id,
        user_id,
        amountPoint,
      });
      await removeRepeatJob(job);
    } else if (
      findBm?.budget &&
      Number(result.spend_cap) > Number(findBm?.budget)
    ) {
      console.log('bạn tiêu quá nên có voucher');
    }
  } catch (fallbackError) {
    await removeRepeatJob(job);
    console.error('❌ Lỗi updateDb:', fallbackError);
    throw fallbackError;
  }
};

fbCheckAccountVisa.process(2, async (job) => {
  const { data } = job;
  console.log('🔄 Processing repeat job:', job.id, data);

  try {
    await updateDb({ job, ...data });
    console.log(`✅ Repeat job ${job.id} completed`);
    return { success: true };
  } catch (err) {
    console.error(`❌ Repeat job ${job.id} failed:`, err);

    // 🚨 QUAN TRỌNG: Với repeat job, nếu muốn STOP khi failed
    // Cần remove toàn bộ repeat job pattern
    if (shouldStopOnFail(err)) {
      console.log('🛑 Stopping repeat job due to critical error');
      await removeRepeatJob(job);
    }

    // Increment failed count nếu có jobId
    if (job.opts.jobId) {
      incrementFailedCountForRepeatJob(job?.opts?.jobId as string);
    }

    throw err;
  }
});

// 🔍 Xác định có nên stop repeat job không
const shouldStopOnFail = (error: any): boolean => {
  // Có thể customize logic này
  const criticalErrors = [
    'không tìm thấy bm id',
    'Invalid access token',
    'Application request limit reached',
    'Tài khoản qc Không tồn tại!',
  ];

  return criticalErrors.some((errMsg) => error.message.includes(errMsg));
};

// 🛑 Remove repeat job
const removeRepeatJob = async (job: Bull.Job) => {
  try {
    // Lấy tất cả repeat jobs
    const repeatJobs = await fbCheckAccountVisa.getRepeatableJobs();

    // Tìm job có cùng pattern
    const targetJob = repeatJobs.find(
      (rJob) =>
        (job.opts.jobId && rJob.id === job.opts.jobId) ||
        rJob.name === job.name,
    );

    if (targetJob) {
      await fbCheckAccountVisa.removeRepeatableByKey(targetJob.key);
      console.log(`🗑️ Removed repeat job: ${targetJob.id}`);
    } else {
      console.log('❌ Could not find repeat job to remove');
    }
  } catch (error) {
    console.error('❌ Error removing repeat job:', error);
  }
};

// 📊 Event handlers cho repeat jobs
fbCheckAccountVisa.on('failed', async (job, err) => {
  console.log(`❌ Job ${job.id} failed:`, err.message);

  // Với repeat job, individual job instance sẽ bị xóa
  // nhưng repeat pattern vẫn tiếp tục
  if (job.opts.repeat) {
    console.log('🔄 This is a repeat job, next instance will be scheduled');

    // Nếu muốn stop repeat job khi failed nhiều lần
    if (job.opts.jobId) {
      const failedCount = await getFailedCountForRepeatJob(
        job.opts.jobId as string,
      );
      if (failedCount >= 3) {
        // Stop sau 3 lần failed
        console.log('🛑 Too many failures, stopping repeat job');
        await removeRepeatJob(job);
      }
    }
  }
});

fbCheckAccountVisa.on('completed', (job, result) => {
  console.log(`✅ Job ${job.id} completed successfully`);
  // Reset failed count khi thành công
  if (job.opts.repeat && job.opts.jobId) {
    resetFailedCountForRepeatJob(job.opts.jobId as string);
  }
});

// 🔢 Đếm số lần failed (lưu trong memory hoặc Redis)
const failedCounts = new Map<string, number>();

const getFailedCountForRepeatJob = async (jobId: string): Promise<number> => {
  return failedCounts.get(jobId) || 0;
};

const incrementFailedCountForRepeatJob = (jobId: string) => {
  const current = failedCounts.get(jobId) || 0;
  failedCounts.set(jobId, current + 1);
};

const resetFailedCountForRepeatJob = (jobId: string) => {
  failedCounts.delete(jobId);
};

// 🚀 Tạo repeat job
export const createRepeatJobVisa = async (data: any) => {
  try {
    const { bm_id, ads_account_id } = data;
    await fbCheckAccountVisa.add(
      {
        ...data,
      },
      {
        repeat: {
          every: 60 * 60 * 1000, // 1 phút
        },
        jobId: `fb-check-account-${bm_id}-${ads_account_id}`, // Unique jobId
        removeOnFail: true,
        removeOnComplete: true,
        attempts: 1,
      },
    );

    console.log(
      `🔄 Created repeat job for BM with add card visa: ${bm_id}, Ads: ${ads_account_id}`,
    );
  } catch (error) {
    console.error('❌ Error creating repeat job:', error);
  }
};

// 🛑 Stop repeat job manually
export const stopRepeatJob = async (bm_id: string, ads_account_id: string) => {
  try {
    const jobId = `fb-check-account-${bm_id}-${ads_account_id}`;
    const repeatJobs = await fbCheckAccountVisa.getRepeatableJobs();

    const targetJob = repeatJobs.find((job) => job.id === jobId);
    if (targetJob) {
      await fbCheckAccountVisa.removeRepeatableByKey(targetJob.key);
      console.log(`🛑 Stopped repeat job: ${jobId}`);
      return true;
    }

    console.log(`❌ Repeat job not found: ${jobId}`);
    return false;
  } catch (error) {
    console.error('❌ Error stopping repeat job:', error);
    return false;
  }
};

// 📊 Kiểm tra repeat jobs
export const checkRepeatJobs = async () => {
  try {
    const repeatJobs = await fbCheckAccountVisa.getRepeatableJobs();
    console.log('📊 Active repeat jobs:', repeatJobs.length);

    repeatJobs.forEach((job) => {
      console.log(
        `- ${job.id}: every ${job.every}ms, next: ${new Date(job.next)}`,
      );
    });

    return repeatJobs;
  } catch (error) {
    console.error('❌ Error checking repeat jobs:', error);
  }
};

// 🧹 Clean up old job instances (chỉ xóa instances, không xóa repeat pattern)
export const cleanupOldJobInstances = async () => {
  try {
    // Xóa completed jobs cũ hơn 5 phút
    await fbCheckAccountVisa.clean(5 * 60 * 1000, 'completed');

    // Xóa failed jobs cũ hơn 5 phút
    await fbCheckAccountVisa.clean(5 * 60 * 1000, 'failed');

    console.log('🧹 Cleaned up old job instances');
  } catch (error) {
    console.error('❌ Error cleaning up:', error);
  }
};
