import { Router, Response } from 'express';
import { reportModel } from '../db/models/Report.js';
import { appointmentModel } from '../db/models/Appointment.js';
import { paymentModel } from '../db/models/Payment.js';
import { AuthRequest, authMiddleware, requireRole, requireStoreAccess } from '../middleware/auth.js';

const router = Router();

router.get('/dashboard', authMiddleware, requireRole('manager', 'admin'), requireStoreAccess, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.storeId && req.user?.role !== 'admin') {
      res.status(400).json({ error: '请选择门店' });
      return;
    }

    const storeId = req.user.storeId;
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const todayAppointments = appointmentModel.findByDate(todayStr, storeId || undefined);
    const todayCount = todayAppointments.length;
    const completedCount = todayAppointments.filter(a => a.status === 'completed').length;
    const pendingCount = todayAppointments.filter(a => a.status === 'confirmed' || a.status === 'pending').length;

    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = thirtyDaysAgo.toISOString().slice(0, 10);
    const endDate = todayStr;

    const appointmentStats = appointmentModel.getStatisticsByDateRange(startDate, endDate, storeId || undefined);
    const revenueStats = paymentModel.getRevenueByDateRange(startDate, endDate, storeId || undefined);

    const satisfactionRanking = storeId
      ? reportModel.getSatisfactionRanking(storeId, startDate, endDate)
      : [];

    const medicineConsumption = storeId
      ? reportModel.getMedicineConsumptionReport(storeId, startDate, endDate)
      : [];

    const totalRevenue = revenueStats.reduce((sum: number, r: any) => sum + (r.total || 0), 0);
    const totalAppointments = appointmentStats.reduce((sum: number, a: any) => sum + (a.count || 0), 0);
    const avgSatisfaction = satisfactionRanking.length > 0
      ? satisfactionRanking.reduce((sum: number, s: any) => sum + (s.avg_satisfaction || 0), 0) / satisfactionRanking.length
      : 0;

    res.json({
      today: {
        total: todayCount,
        completed: completedCount,
        pending: pendingCount
      },
      stats: {
        totalRevenue,
        totalAppointments,
        avgSatisfaction: parseFloat(avgSatisfaction.toFixed(2))
      },
      appointmentStats,
      revenueStats,
      satisfactionRanking,
      medicineConsumption
    });
  } catch (error) {
    console.error('获取控制台数据失败:', error);
    res.status(500).json({ error: '获取控制台数据失败' });
  }
});

router.get('/satisfaction', authMiddleware, requireRole('manager', 'admin'), requireStoreAccess, (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user?.storeId) {
      res.status(400).json({ error: '请选择门店' });
      return;
    }

    const { startDate, endDate } = req.query;
    const today = new Date();
    const defaultStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const start = (startDate as string) || defaultStart.toISOString().slice(0, 10);
    const end = (endDate as string) || today.toISOString().slice(0, 10);

    const ranking = reportModel.getSatisfactionRanking(req.user.storeId, start, end);
    res.json(ranking);
  } catch (error) {
    console.error('获取满意度排行失败:', error);
    res.status(500).json({ error: '获取满意度排行失败' });
  }
});

router.get('/revenue', authMiddleware, requireRole('manager', 'admin'), requireStoreAccess, (req: AuthRequest, res: Response): void => {
  try {
    const { startDate, endDate } = req.query;
    const storeId = req.user?.storeId;
    const today = new Date();
    const defaultStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const start = (startDate as string) || defaultStart.toISOString().slice(0, 10);
    const end = (endDate as string) || today.toISOString().slice(0, 10);

    const revenue = paymentModel.getRevenueByDateRange(start, end, storeId || undefined);
    res.json(revenue);
  } catch (error) {
    console.error('获取营收数据失败:', error);
    res.status(500).json({ error: '获取营收数据失败' });
  }
});

router.get('/medicine-consumption', authMiddleware, requireRole('manager', 'admin', 'pharmacist'), requireStoreAccess, (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user?.storeId) {
      res.status(400).json({ error: '请选择门店' });
      return;
    }

    const { startDate, endDate } = req.query;
    const today = new Date();
    const defaultStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const start = (startDate as string) || defaultStart.toISOString().slice(0, 10);
    const end = (endDate as string) || today.toISOString().slice(0, 10);

    const consumption = reportModel.getMedicineConsumptionReport(req.user.storeId, start, end);
    res.json(consumption);
  } catch (error) {
    console.error('获取药品消耗数据失败:', error);
    res.status(500).json({ error: '获取药品消耗数据失败' });
  }
});

router.get('/appointments', authMiddleware, requireRole('manager', 'admin'), requireStoreAccess, (req: AuthRequest, res: Response): void => {
  try {
    const { startDate, endDate } = req.query;
    const storeId = req.user?.storeId;
    const today = new Date();
    const defaultStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const start = (startDate as string) || defaultStart.toISOString().slice(0, 10);
    const end = (endDate as string) || today.toISOString().slice(0, 10);

    const stats = appointmentModel.getStatisticsByDateRange(start, end, storeId || undefined);
    res.json(stats);
  } catch (error) {
    console.error('获取预约统计失败:', error);
    res.status(500).json({ error: '获取预约统计失败' });
  }
});

router.get('/', authMiddleware, requireRole('manager', 'admin'), (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const reports = reportModel.findByStoreId(req.user.storeId || '');
    res.json(reports);
  } catch (error) {
    console.error('获取报表列表失败:', error);
    res.status(500).json({ error: '获取报表列表失败' });
  }
});

router.post('/generate-daily', authMiddleware, requireRole('manager', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { date, storeId } = req.body;
    const report = reportModel.generateDailyReport(date || new Date().toISOString().slice(0, 10), storeId);
    res.status(201).json(report);
  } catch (error) {
    console.error('生成日报表失败:', error);
    res.status(500).json({ error: '生成日报表失败' });
  }
});

export default router;
