import cron from 'node-cron';
import { reportModel } from '../db/models/Report.js';
import { storeModel } from '../db/models/Store.js';
import { medicalRecordModel } from '../db/models/MedicalRecord.js';
import { petModel } from '../db/models/Pet.js';
import { sendNotification } from './socket.js';
import { userModel } from '../db/models/User.js';

export function initCronJobs(): void {
  cron.schedule('0 0 1 * * *', async () => {
    console.log('开始生成每日报表...');
    await generateDailyReports();
    console.log('每日报表生成完成');
  });

  cron.schedule('0 0 9 * * *', async () => {
    console.log('开始发送复诊提醒...');
    await sendFollowUpReminders();
    console.log('复诊提醒发送完成');
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

async function sendFollowUpReminders(): Promise<void> {
  const today = new Date();
  const inThreeDays = new Date();
  inThreeDays.setDate(today.getDate() + 3);

  const todayStr = today.toISOString().slice(0, 10);
  const inThreeDaysStr = inThreeDays.toISOString().slice(0, 10);

  try {
    const followUps = medicalRecordModel.findUpcomingFollowUps(todayStr, inThreeDaysStr);
    console.log(`找到 ${followUps.length} 个即将到期的复诊提醒`);

    for (const fu of followUps) {
      try {
        const pet = petModel.findById(fu.petId);
        const followUpDate = new Date(fu.followUpDate);
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        followUpDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((followUpDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

        let reminderText = '';
        if (diffDays === 0) {
          reminderText = '今天';
        } else if (diffDays === 1) {
          reminderText = '明天';
        } else {
          reminderText = `${diffDays}天后`;
        }

        const notesText = fu.followUpNotes ? `\n注意事项：${fu.followUpNotes}` : '';

        await sendNotification(
          fu.ownerId,
          'follow_up',
          '复诊提醒',
          `您的宠物${pet?.name || ''}的复诊日期为${reminderText}（${new Date(fu.followUpDate).toLocaleDateString('zh-CN')}）${notesText}\n点击查看详情并预约复诊`,
          fu.id
        );
      } catch (error) {
        console.error(`发送复诊提醒失败 ${fu.id}:`, error);
      }
    }
  } catch (error) {
    console.error('查询复诊提醒失败:', error);
  }
}

async function generateWeeklyReports(): Promise<void> {
  console.log('生成周报表...');
}

async function generateMonthlyReports(): Promise<void> {
  console.log('生成月报表...');
}
