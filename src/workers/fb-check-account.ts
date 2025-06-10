import Bull from 'bull';
import prisma from '../config/prisma';
import { decryptToken } from '../controllers/facebookBm.controller';
import axios from 'axios';
import { differenceInDays } from 'date-fns';
import { fbRemoveParnert } from './fb-partner-remove';
function isMoreThan7DaysOld(createdAt: string | Date): boolean {
  const now = new Date();
  const createdDate = new Date(createdAt);

  const diffDays = differenceInDays(now, createdDate);

  return diffDays > 7;
}

function isMoreThan2MinutesOld(createdAt: string | Date): boolean {
  const now = new Date();
  const createdDate = new Date(createdAt);

  const diffMs = now.getTime() - createdDate.getTime();
  return diffMs > 2 * 60 * 1000;
}

export const fbCheckAccount = new Bull('fb-check-account', {
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
  try {
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
        status_limit_spend: 1,
      },
    });
    if (Number(result.spend_cap) >= amountPoint * 0.95) {
      // gửi đi cảnh báo và xóa job
      await prisma.facebookPartnerBM.update({
        where: {
          id: findBm?.id,
        },
        data: {
          message: 'Quý khách đã chạy ngưỡng 95% số tiền thuê tài khoản!',
        },
      });
      console.log('cảnh báo !!!!!!!!!');
      await removeRepeatJob(job);
      return;
    } else if (
      Number(result.amount_spent) == 0 &&
      findBm?.created_at &&
      isMoreThan7DaysOld(findBm?.created_at || '')
    ) {
      const amountVNDchange = Math.floor(Number(amountPoint));
      const poitsUsedTransaction = await prisma.$transaction(async (tx) => {
        const adsAccount = await tx.adsAccount.findFirst({
          where: {
            account_id: ads_account_id,
          },
        });
        if (!adsAccount) throw new Error('Tài khoản qc Không tồn tại!');
        const user = await tx.user.findUnique({
          where: { id: user_id },
        });
        const newListAds = user?.list_ads_account.filter(
          (item) => item !== ads_account_id,
        );
        await tx.user.update({
          where: { id: user_id },
          data: {
            points: { increment: amountVNDchange },
            list_ads_account: newListAds || [],
          },
        });
        const pointsUsed = await tx.pointUsage.create({
          data: {
            user_id,
            points_used: amountVNDchange,
            target_account: ads_account_id,
            description: 'Hoàn điểm tài khoản quảng cáo',
            status: 'success',
          },
        });
        return pointsUsed;
      });
      console.log('poitsUsedTransaction', poitsUsedTransaction);
      await fbRemoveParnert.add({
        bm_id,
        ads_account_id,
        user_id,
        bm_origin,
        ads_name,
        bot_id,
        id: findBm.id,
      });
      await removeRepeatJob(job);
      return;
    }
  } catch (fallbackError) {
    console.error('❌ Lỗi updateDb:', fallbackError);
    throw fallbackError;
  }
};

fbCheckAccount.process(15, async (job) => {
  const { data } = job;
  console.log('🔄 Processing repeat job:', job.id, data);

  try {
    await updateDb({ ...data, job });
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
    const repeatJobs = await fbCheckAccount.getRepeatableJobs();

    // Tìm job có cùng pattern
    const targetJob = repeatJobs.find(
      (rJob) =>
        (job.opts.jobId && rJob.id === job.opts.jobId) ||
        rJob.name === job.name,
    );

    if (targetJob) {
      await fbCheckAccount.removeRepeatableByKey(targetJob.key);
      console.log(`🗑️ Removed repeat job: ${targetJob.id}`);
    } else {
      console.log('❌ Could not find repeat job to remove');
    }
  } catch (error) {
    console.error('❌ Error removing repeat job:', error);
  }
};

// 📊 Event handlers cho repeat jobs
fbCheckAccount.on('failed', async (job, err) => {
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

fbCheckAccount.on('completed', (job, result) => {
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
export const createRepeatJob = async (data: any) => {
  try {
    const { bm_id, ads_account_id } = data;
    await fbCheckAccount.add(
      {
        ...data,
      },
      {
        repeat: {
          every: 1 * 60 * 1000, // 1 phút
        },
        jobId: `fb-check-account-${bm_id}-${ads_account_id}`, // Unique jobId
        removeOnFail: true,
        removeOnComplete: true,
        attempts: 1,
      },
    );

    console.log(
      `🔄 Created repeat job for BM: ${bm_id}, Ads: ${ads_account_id}`,
    );
  } catch (error) {
    console.error('❌ Error creating repeat job:', error);
  }
};

// 🛑 Stop repeat job manually
export const stopRepeatJob = async (bm_id: string, ads_account_id: string) => {
  try {
    const jobId = `fb-check-account-${bm_id}-${ads_account_id}`;
    const repeatJobs = await fbCheckAccount.getRepeatableJobs();

    const targetJob = repeatJobs.find((job) => job.id === jobId);
    if (targetJob) {
      await fbCheckAccount.removeRepeatableByKey(targetJob.key);
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
    const repeatJobs = await fbCheckAccount.getRepeatableJobs();
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
    await fbCheckAccount.clean(5 * 60 * 1000, 'completed');

    // Xóa failed jobs cũ hơn 5 phút
    await fbCheckAccount.clean(5 * 60 * 1000, 'failed');

    console.log('🧹 Cleaned up old job instances');
  } catch (error) {
    console.error('❌ Error cleaning up:', error);
  }
};
