import { Router, Response } from 'express';
import { paymentModel } from '../db/models/Payment.js';
import { userModel } from '../db/models/User.js';
import { appointmentModel } from '../db/models/Appointment.js';
import { prescriptionModel } from '../db/models/Prescription.js';
import { medicalRecordModel } from '../db/models/MedicalRecord.js';
import { medicineModel } from '../db/models/Medicine.js';
import { dispenseRecordModel } from '../db/models/DispenseRecord.js';
import { storeModel } from '../db/models/Store.js';
import { AuthRequest, authMiddleware, requireRole } from '../middleware/auth.js';
import { sendNotification } from '../services/socket.js';
import { fetchAll } from '../db/database.js';
import { CalculatePaymentRequest, CalculatePaymentResponse, PaymentRequest, PrescriptionItemForBill } from '../../shared/types.js';

const router = Router();
const CONSULTATION_FEE = 50;

router.post('/calculate', authMiddleware, requireRole('owner'), (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const { appointmentId, usePoints = 0 }: CalculatePaymentRequest = req.body;

    if (!appointmentId) {
      res.status(400).json({ error: '请提供预约ID' });
      return;
    }

    const appointment = appointmentModel.findById(appointmentId);
    if (!appointment) {
      res.status(404).json({ error: '预约不存在' });
      return;
    }

    if (appointment.ownerId !== req.user.id) {
      res.status(403).json({ error: '无权支付此预约' });
      return;
    }

    const user = userModel.findById(req.user.id);
    if (!user) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }

    const record = medicalRecordModel.findByAppointmentId(appointmentId);
    const prescription = record ? prescriptionModel.findByMedicalRecordId(record.id) : null;

    if (!prescription) {
      res.status(400).json({ error: '该预约尚未开具处方，请完成诊疗后再支付', hasPrescription: false });
      return;
    }

    const prescriptionItems = prescriptionModel.getItems(prescription.id);
    const medicineItems: PrescriptionItemForBill[] = prescriptionItems.map(item => {
      const medicine = medicineModel.findById(item.medicineId);
      return {
        medicineId: item.medicineId,
        medicineName: medicine?.name || '未知药品',
        quantity: item.quantity,
        unitPrice: medicine?.price || 0,
        subtotal: (medicine?.price || 0) * item.quantity,
        dosage: item.dosage,
        frequency: item.frequency
      };
    });

    const medicineAmount = medicineItems.reduce((sum, item) => sum + item.subtotal, 0);
    const originalAmount = medicineAmount + CONSULTATION_FEE;

    const memberDiscount = paymentModel.calculateMemberDiscount(originalAmount, user.memberLevel);

    const maxUsablePoints = Math.min(Math.max(0, usePoints), user.memberPoints);
    const amountAfterDiscount = originalAmount - memberDiscount;
    const { pointsUsed: optimalPointsUsed, deduction: pointsDeduction } = paymentModel.calculateOptimalPoints(maxUsablePoints, amountAfterDiscount);

    const finalAmount = Math.max(0, Math.round((originalAmount - memberDiscount - pointsDeduction) * 100) / 100);
    const earnedPoints = paymentModel.calculateEarnedPoints(finalAmount);
    const remainingPoints = user.memberPoints - optimalPointsUsed + earnedPoints;

    const response: CalculatePaymentResponse = {
      appointmentId: appointment.id,
      appointmentCode: appointment.appointmentCode,
      consultationFee: CONSULTATION_FEE,
      medicineAmount,
      medicineItems,
      originalAmount,
      memberLevel: user.memberLevel,
      memberDiscount,
      pointsUsed: optimalPointsUsed,
      pointsDeduction,
      remainingPoints,
      finalAmount,
      earnedPoints,
      hasPrescription: true
    };

    res.json(response);
  } catch (error) {
    console.error('计算费用失败:', error);
    res.status(500).json({ error: '计算费用失败' });
  }
});

router.post('/', authMiddleware, requireRole('owner'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const { appointmentId, amount, paymentMethod, usePoints }: PaymentRequest = req.body;

    if (!appointmentId || paymentMethod === undefined || paymentMethod === null) {
      res.status(400).json({ error: '请填写完整的支付信息' });
      return;
    }

    const appointment = appointmentModel.findById(appointmentId);
    if (!appointment) {
      res.status(404).json({ error: '预约不存在' });
      return;
    }

    if (appointment.ownerId !== req.user.id) {
      res.status(403).json({ error: '无权支付此预约' });
      return;
    }

    const user = userModel.findById(req.user.id);
    if (!user) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }

    const record = medicalRecordModel.findByAppointmentId(appointmentId);
    const prescription = record ? prescriptionModel.findByMedicalRecordId(record.id) : null;

    if (!prescription) {
      res.status(400).json({ error: '该预约尚未开具处方，请完成诊疗后再支付', hasPrescription: false });
      return;
    }

    const medicineTotal = prescriptionModel.calculateTotal(prescription.id);
    const originalAmount = medicineTotal + CONSULTATION_FEE;

    const memberDiscount = paymentModel.calculateMemberDiscount(originalAmount, user.memberLevel);
    const maxUsablePoints = Math.min(Math.max(0, usePoints || 0), user.memberPoints);
    const amountAfterDiscount = originalAmount - memberDiscount;
    const { pointsUsed: optimalPointsUsed, deduction: pointsDeduction } = paymentModel.calculateOptimalPoints(maxUsablePoints, amountAfterDiscount);
    const serverFinalAmount = Math.max(0, Math.round((originalAmount - memberDiscount - pointsDeduction) * 100) / 100);

    if (Math.abs(serverFinalAmount - amount) > 0.01) {
      res.status(400).json({
        error: `支付金额校验失败: 服务端计算金额为 ¥${serverFinalAmount.toFixed(2)}，与提交金额 ¥${amount.toFixed(2)} 不一致`,
        serverAmount: serverFinalAmount,
        submittedAmount: amount
      });
      return;
    }

    const earnedPoints = paymentModel.calculateEarnedPoints(serverFinalAmount);

    const existingPayment = paymentModel.findByAppointmentId(appointmentId);
    if (existingPayment && existingPayment.status === 'paid') {
      res.status(400).json({ error: '该预约已支付' });
      return;
    }

    const payment = existingPayment
      ? paymentModel.updateStatus(existingPayment.id, 'paid', new Date().toISOString())
      : paymentModel.create({
          appointmentId,
          originalAmount,
          memberDiscount,
          pointsDeduction,
          finalAmount: serverFinalAmount,
          paymentMethod,
          status: 'paid',
          paidAt: new Date().toISOString()
        });

    if (optimalPointsUsed > 0) {
      userModel.updatePoints(req.user.id, -optimalPointsUsed);
      paymentModel.addTransaction({
        userId: req.user.id,
        paymentId: payment.id,
        type: 'spend',
        pointsChange: -optimalPointsUsed,
        balanceAfter: user.memberPoints - optimalPointsUsed,
        description: '支付抵扣'
      });
    }

    if (earnedPoints > 0) {
      userModel.updatePoints(req.user.id, earnedPoints);
      paymentModel.addTransaction({
        userId: req.user.id,
        paymentId: payment.id,
        type: 'earn',
        pointsChange: earnedPoints,
        balanceAfter: user.memberPoints - optimalPointsUsed + earnedPoints,
        description: '消费赠送'
      });
    }

    appointmentModel.updateStatus(appointmentId, 'completed');

    await sendNotification(
      req.user.id,
      'payment',
      '支付成功',
      `预约码：${appointment.appointmentCode}\n实付金额：¥${serverFinalAmount.toFixed(2)}\n获得积分：${earnedPoints}积分\n点击查看电子账单详情`,
      payment.id
    );

    const updatedUser = userModel.findById(req.user.id);
    const { passwordHash, ...userWithoutPassword } = updatedUser!;

    const prescriptionItems = prescriptionModel.getItems(prescription.id);
    const medicineItems = prescriptionItems.map(item => {
      const medicine = medicineModel.findById(item.medicineId);
      return {
        medicineId: item.medicineId,
        medicineName: medicine?.name || '未知药品',
        quantity: item.quantity,
        unitPrice: medicine?.price || 0,
        subtotal: (medicine?.price || 0) * item.quantity
      };
    });

    res.json({
      payment: {
        ...payment,
        appointmentCode: appointment.appointmentCode,
        consultationFee: CONSULTATION_FEE,
        medicineAmount: medicineTotal,
        medicineItems,
        pointsUsed: optimalPointsUsed,
        earnedPoints,
        memberLevel: user.memberLevel
      },
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('支付失败:', error);
    res.status(500).json({ error: '支付失败' });
  }
});

router.get('/my-payments', authMiddleware, requireRole('owner'), (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const payments = paymentModel.findByOwnerId(req.user.id);
    res.json(payments);
  } catch (error) {
    console.error('获取支付记录失败:', error);
    res.status(500).json({ error: '获取支付记录失败' });
  }
});

router.get('/:id', authMiddleware, (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const payment = paymentModel.findById(req.params.id);
    if (!payment) {
      res.status(404).json({ error: '支付记录不存在' });
      return;
    }

    const appointment = appointmentModel.findById(payment.appointmentId);
    if (!appointment) {
      res.status(404).json({ error: '预约不存在' });
      return;
    }

    if (req.user.role === 'owner' && appointment.ownerId !== req.user.id) {
      res.status(403).json({ error: '无权访问此支付记录' });
      return;
    }

    if ((req.user.role === 'doctor' || req.user.role === 'pharmacist' || req.user.role === 'manager') &&
        req.user.storeId && appointment.storeId !== req.user.storeId) {
      res.status(403).json({ error: '无权访问此支付记录' });
      return;
    }

    const record = medicalRecordModel.findByAppointmentId(payment.appointmentId);
    const prescription = record ? prescriptionModel.findByMedicalRecordId(record.id) : null;
    const prescriptionItems = prescription ? prescriptionModel.getItems(prescription.id) : [];
    const medicineItems = prescriptionItems.map(item => {
      const medicine = medicineModel.findById(item.medicineId);
      return {
        medicineId: item.medicineId,
        medicineName: medicine?.name || '未知药品',
        quantity: item.quantity,
        unitPrice: medicine?.price || 0,
        subtotal: (medicine?.price || 0) * item.quantity,
        dosage: item.dosage,
        frequency: item.frequency
      };
    });

    const dispenseRecord = prescription ? dispenseRecordModel.findByPrescriptionId(prescription.id) : null;
    const pharmacist = dispenseRecord?.pharmacistId ? userModel.findById(dispenseRecord.pharmacistId) : null;
    const store = appointment.storeId ? storeModel.findById(appointment.storeId) : null;
    const user = userModel.findById(appointment.ownerId);

    res.json({
      ...payment,
      appointmentCode: appointment.appointmentCode,
      appointmentTime: appointment.appointmentTime,
      symptoms: appointment.symptoms,
      consultationFee: CONSULTATION_FEE,
      medicineAmount: medicineItems.reduce((sum, item) => sum + item.subtotal, 0),
      medicineItems,
      memberLevel: user?.memberLevel || 1,
      ownerName: user?.name,
      storeId: appointment.storeId,
      storeName: store?.name,
      storeAddress: store?.address,
      storePhone: store?.phone,
      prescriptionStatus: prescription?.status || null,
      needConfirmation: prescription?.needConfirmation || false,
      dispenseRecord: dispenseRecord ? {
        ...dispenseRecord,
        pharmacistName: pharmacist?.name
      } : null,
      pickupStatus: dispenseRecord
        ? (dispenseRecord.dispensedAt ? 'dispensed' : 'ready')
        : (prescription?.status === 'reviewed' ? 'pending_dispense' : 'pending_review')
    });
  } catch (error) {
    console.error('获取支付详情失败:', error);
    res.status(500).json({ error: '获取支付详情失败' });
  }
});

router.get('/store/:storeId/orders', authMiddleware, requireRole('manager', 'admin', 'pharmacist'), (req: AuthRequest, res: Response): void => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      res.status(400).json({ error: '请提供开始和结束日期' });
      return;
    }

    const startDateTime = `${startDate as string} 00:00:00`;
    const endDateTime = `${endDate as string} 23:59:59`;

    const rows = fetchAll(
      `SELECT p.*, a.appointment_code, a.appointment_time, u.name as owner_name,
              u.phone as owner_phone,
              p.points_deduction as points_deduction
       FROM payments p
       JOIN appointments a ON p.appointment_id = a.id
       JOIN users u ON a.owner_id = u.id
       WHERE p.status = 'paid'
       AND a.store_id = ?
       AND p.paid_at >= ?
       AND p.paid_at <= ?
       ORDER BY p.paid_at DESC`,
      [req.params.storeId, startDateTime, endDateTime]
    );

    res.json({
      count: rows.length,
      orders: rows.map((r: any) => ({
        paymentId: r.id,
        appointmentId: r.appointment_id,
        appointmentCode: r.appointment_code,
        appointmentTime: r.appointment_time,
        ownerName: r.owner_name,
        ownerPhone: r.owner_phone,
        originalAmount: r.original_amount,
        memberDiscount: r.member_discount,
        pointsDeduction: r.points_deduction,
        finalAmount: r.final_amount,
        paymentMethod: r.payment_method,
        paidAt: r.paid_at
      }))
    });
  } catch (error) {
    console.error('获取门店订单明细失败:', error);
    res.status(500).json({ error: '获取门店订单明细失败' });
  }
});

router.get('/summary/by-store', authMiddleware, requireRole('manager', 'admin'), (req: AuthRequest, res: Response): void => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      res.status(400).json({ error: '请提供开始和结束日期' });
      return;
    }

    const startDateTime = `${startDate as string} 00:00:00`;
    const endDateTime = `${endDate as string} 23:59:59`;

    const rows = fetchAll(
      `SELECT a.store_id, s.name as store_name,
              COUNT(*) as order_count,
              SUM(p.original_amount) as total_original,
              SUM(p.member_discount) as total_discount,
              SUM(p.points_deduction) as total_points_deduction,
              SUM(p.final_amount) as total_revenue
       FROM payments p
       JOIN appointments a ON p.appointment_id = a.id
       JOIN stores s ON a.store_id = s.id
       WHERE p.status = 'paid'
       AND p.paid_at >= ?
       AND p.paid_at <= ?
       GROUP BY a.store_id, s.name
       ORDER BY total_revenue DESC`,
      [startDateTime, endDateTime]
    );

    const overall = {
      orderCount: rows.reduce((sum: number, r: any) => sum + r.order_count, 0),
      totalOriginal: rows.reduce((sum: number, r: any) => sum + r.total_original, 0),
      totalDiscount: rows.reduce((sum: number, r: any) => sum + r.total_discount, 0),
      totalPointsDeduction: rows.reduce((sum: number, r: any) => sum + r.total_points_deduction, 0),
      totalRevenue: rows.reduce((sum: number, r: any) => sum + r.total_revenue, 0),
      storeCount: rows.length
    };

    res.json({
      overall,
      byStore: rows.map((r: any) => ({
        storeId: r.store_id,
        storeName: r.store_name,
        orderCount: r.order_count,
        totalOriginal: r.total_original,
        totalDiscount: r.total_discount,
        totalPointsDeduction: r.total_points_deduction,
        totalRevenue: r.total_revenue
      }))
    });
  } catch (error) {
    console.error('获取支付汇总失败:', error);
    res.status(500).json({ error: '获取支付汇总失败' });
  }
});

router.get('/transactions/my', authMiddleware, requireRole('owner'), (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const transactions = paymentModel.getTransactions(req.user.id);
    res.json(transactions);
  } catch (error) {
    console.error('获取积分记录失败:', error);
    res.status(500).json({ error: '获取积分记录失败' });
  }
});

export default router;
