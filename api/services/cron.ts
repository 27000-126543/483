import cron from 'node-cron';
import { reportModel } from '../db/models/Report.js';
import { storeModel } from '../db/models/Store.js';
import { sendNotification } from './socket.js';
import { userModel } from '../db/models/User.js';

export function initCronJobs(): void {
  cron.schedule('0 0 1 * * *', async () => {
    console.log('开始生成每日报表...');
    await generateDailyReports();
    console.log('每日报表生成完成');
  });

  cron.schedule('0 0 * * 1', async () => {
    console.log('开始生成每周报表...');
    await generateWeeklyReports();
    console.log('每周报表生成完成');
  });

  cron.schedule('0 0 1 * *', async () => {
    console.log('开始生成每月报表...');
    await generateMonthlyReports();
    console.log('每月报表生成完成');
  });

  console.log('定时任务已初始化');
}

async function generateDailyReports(): Promise<void> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);

  const stores = storeModel.findAll();
  for (const store of stores) {
    try {
      const report = reportModel.generateDailyReport(dateStr, store.id);
      console.log(`已生成门店 ${store.name} 的日报表: ${report.id}`);

      const managers = userModel.findByStoreAndRole(store.id, 'manager');
      for (const manager of managers) {
        await sendNotification(
          manager.id,
          'system',
          '每日报表已生成',
          `${store.name} ${dateStr} 营业报表已生成，请查看详情。`,
          report.id
        );
      }
    } catch (error) {
      console.error(`生成门店 ${store.id} 日报表失败:`, error);
    }
  }

  try {
    const report = reportModel.generateDailyReport(dateStr);
    console.log(`已生成总部日报表: ${report.id}`);

    const admins = userModel.findByRole('admin');
    for (const admin of admins) {
      await sendNotification(
        admin.id,
        'system',
        '总部每日报表已生成',
        `${dateStr} 全部门店营业报表已生成，请查看详情。`,
        report.id
      );
    }
  } catch (error) {
    console.error('生成总部日报表失败:', error);
  }
}

async function generateWeeklyReports(): Promise<void> {
  console.log('生成周报表...');
}

async function generateMonthlyReports(): Promise<void> {
  console.log('生成月报表...');
}
