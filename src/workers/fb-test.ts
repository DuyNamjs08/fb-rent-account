import Bull from 'bull';
import { autoTest } from '../auto-test';
import 'dotenv/config';

export const fbTest = new Bull('fb-test', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380', 10),
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: true,
  },
});
fbTest.process(2, async (job) => {
  const { data } = job;
  try {
    console.log(`[START] Job ${job.id} at ${new Date().toISOString()}`);
    await new Promise((r) => setTimeout(r, 45000)); // giả lập job 5s
    console.log(`[DONE] Job ${job.id} at ${new Date().toISOString()}`);
    console.log(`✅ Cập nhật test`, job.id, data);
    return true;
  } catch (err) {
    console.error(`❌ Lỗi khi cập nhật test`, err);
    throw err;
  }
});
fbTest.on('waiting', (jobId) => {
  console.log(`⏳ Job ${jobId} is waiting`);
});

fbTest.on('active', (job) => {
  console.log(`🔄 Job ${job.id} started processing (active event)`);
});

fbTest.on('completed', (job, result) => {
  console.log(`✅ Job ${job.id} completed with result:`, result);
});

fbTest.on('failed', (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err.message);
});

fbTest.on('removed', (job) => {
  console.log(`🗑️ Job ${job.id} was removed`);
});

fbTest.on('error', (error) => {
  console.error('🚨 Queue error:', error);
});
