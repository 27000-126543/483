import { Router, Response } from 'express';
import { paymentModel } from '../db/models/Payment.js';
import { userModel } from '../db/models/User.js';
import { appointmentModel } from '../db/models/Appointment.js';
import { prescriptionModel } from '../db/models/Prescription.js';
import { medicalRecordModel } from '../db/models/MedicalRecord.js';
import { AuthRequest, authMiddleware, requireRole } from '../middleware/auth.js';
import { sendNotification } from '../services/socket.js';
import { CalculatePaymentRequest, CalculatePaymentResponse, PaymentRequest } from '../../shared/types.js';

const router = Router();

router.post('/calculate', authMiddleware, requireRole('owner'), (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const { appointmentId, usePoints }: CalculatePaymentRequest = req.body;

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
    if (!record) {
      res.status(400).json({ error: '该预约尚未完成诊疗' });
      return;
    }

    const prescription = prescriptionModel.findByMedicalRecordId(record.id);
    if (!prescription) {
      res.status(400).json({ error: '该预约尚未开具处方' });
      return;
    }

    const medicineTotal = prescriptionModel.calculateTotal(prescription.id);
    const consultationFee = 50;
    const originalAmount = medicineTotal + consultationFee;

    const memberDiscount = paymentModel.calculateMemberDiscount(originalAmount, user.memberLevel);

    const maxPointsToUse = Math.min(usePoints || 0, user.memberPoints);
    const pointsDeduction = paymentModel.calculatePointsDeduction(maxPointsToUse);

    const finalAmount = Math.max(0, originalAmount - memberDiscount - pointsDeduction);
    const earnedPoints = paymentModel.calculateEarnedPoints(finalAmount);

    const response: CalculatePaymentResponse = {
      originalAmount,
      memberDiscount,
      pointsDeduction,
      finalAmount,
      earnedPoints
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

    if (!appointmentId || !amount || !paymentMethod) {
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
    const medicineTotal = prescription ? prescriptionModel.calculateTotal(prescription.id) : 0;
    const consultationFee = 50;
    const originalAmount = medicineTotal + consultationFee;

    const memberDiscount = paymentModel.calculateMemberDiscount(originalAmount, user.memberLevel);
    const actualUsePoints = Math.min(usePoints || 0, user.memberPoints);
    const pointsDeduction = paymentModel.calculatePointsDeduction(actualUsePoints);
    const serverFinalAmount = Math.max(0, originalAmount - memberDiscount - pointsDeduction);

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

    if (actualUsePoints > 0) {
      userModel.updatePoints(req.user.id, -actualUsePoints);
      paymentModel.addTransaction({
        userId: req.user.id,
        paymentId: payment.id,
        type: 'spend',
        pointsChange: -actualUsePoints,
        balanceAfter: user.memberPoints - actualUsePoints,
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
        balanceAfter: user.memberPoints - actualUsePoints + earnedPoints,
        description: '消费赠送'
      });
    }

    appointmentModel.updateStatus(appointmentId, 'completed');

    await sendNotification(
      req.user.id,
      'payment',
      '支付成功',
      `您已成功支付 ¥${serverFinalAmount.toFixed(2)}，获得 ${earnedPoints} 积分。感谢您的信任！`,
      payment.id
    );

    const updatedUser = userModel.findById(req.user.id);
    const { passwordHash, ...userWithoutPassword } = updatedUser!;

    res.json({
      payment,
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
    if (req.user.role === 'owner' && appointment?.ownerId !== req.user.id) {
      res.status(403).json({ error: '无权访问此支付记录' });
      return;
    }

    if ((req.user.role === 'doctor' || req.user.role === 'pharmacist' || req.user.role === 'manager') &&
        req.user.storeId && appointment?.storeId !== req.user.storeId) {
      res.status(403).json({ error: '无权访问此支付记录' });
      return;
    }

    res.json(payment);
  } catch (error) {
    console.error('获取支付详情失败:', error);
    res.status(500).json({ error: '获取支付详情失败' });
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
