import { Router, Response } from 'express';
import { prescriptionModel } from '../db/models/Prescription.js';
import { inventoryModel } from '../db/models/Inventory.js';
import { dispenseRecordModel } from '../db/models/DispenseRecord.js';
import { AuthRequest, authMiddleware, requireRole, requireStoreAccess } from '../middleware/auth.js';
import { sendNotification } from '../services/socket.js';
import { generateQRCode } from '../services/utils.js';
import { appointmentModel } from '../db/models/Appointment.js';
import { medicalRecordModel } from '../db/models/MedicalRecord.js';
import { medicineModel } from '../db/models/Medicine.js';

const router = Router();

router.get('/prescriptions/pending', authMiddleware, requireRole('pharmacist', 'manager'), requireStoreAccess, (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user?.storeId) {
      res.status(400).json({ error: '请选择门店' });
      return;
    }

    const prescriptions = prescriptionModel.findByStoreId(req.user.storeId)
      .filter(p => p.status === 'confirmed');

    const prescriptionsWithItems = prescriptions.map(p => ({
      ...p,
      items: prescriptionModel.getItems(p.id)
    }));

    res.json(prescriptionsWithItems);
  } catch (error) {
    console.error('获取待审核处方失败:', error);
    res.status(500).json({ error: '获取待审核处方失败' });
  }
});

router.get('/prescriptions/to-dispense', authMiddleware, requireRole('pharmacist', 'manager'), requireStoreAccess, (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user?.storeId) {
      res.status(400).json({ error: '请选择门店' });
      return;
    }

    const prescriptions = prescriptionModel.findByStoreId(req.user.storeId)
      .filter(p => p.status === 'reviewed');

    const prescriptionsWithItems = prescriptions.map(p => ({
      ...p,
      items: prescriptionModel.getItems(p.id)
    }));

    res.json(prescriptionsWithItems);
  } catch (error) {
    console.error('获取待配药处方失败:', error);
    res.status(500).json({ error: '获取待配药处方失败' });
  }
});

router.put('/prescriptions/:id/review', authMiddleware, requireRole('pharmacist'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const prescription = prescriptionModel.findById(req.params.id);
    if (!prescription) {
      res.status(404).json({ error: '处方不存在' });
      return;
    }

    if (prescription.status !== 'confirmed') {
      res.status(400).json({ error: '处方状态不正确' });
      return;
    }

    const { approved, reason } = req.body;

    if (!approved) {
      const updated = prescriptionModel.updateStatus(req.params.id, 'cancelled');
      const record = medicalRecordModel.findById(updated.medicalRecordId);
      if (record) {
        const appointment = appointmentModel.findById(record.appointmentId);
        if (appointment) {
          await sendNotification(
            appointment.ownerId,
            'prescription',
            '处方审核未通过',
            reason || '处方审核未通过，请联系医生。',
            updated.id
          );
        }
      }
      res.json(updated);
      return;
    }

    const updated = prescriptionModel.updateStatus(req.params.id, 'reviewed');
    const items = prescriptionModel.getItems(req.params.id);

    const record = medicalRecordModel.findById(updated.medicalRecordId);
    if (record) {
      const appointment = appointmentModel.findById(record.appointmentId);
      if (appointment) {
        await sendNotification(
          appointment.ownerId,
          'prescription',
          '处方已审核通过',
          '您的处方已通过审核，可以前往药房取药。',
          updated.id
        );
      }
    }

    res.json({ ...updated, items });
  } catch (error) {
    console.error('审核处方失败:', error);
    res.status(500).json({ error: '审核处方失败' });
  }
});

router.post('/prescriptions/:id/dispense', authMiddleware, requireRole('pharmacist'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const prescription = prescriptionModel.findById(req.params.id);
    if (!prescription) {
      res.status(404).json({ error: '处方不存在' });
      return;
    }

    if (prescription.status !== 'reviewed') {
      res.status(400).json({ error: '处方状态不正确，请先审核' });
      return;
    }

    const items = prescriptionModel.getItems(req.params.id);

    const record = medicalRecordModel.findById(prescription.medicalRecordId);
    if (!record) {
      res.status(404).json({ error: '病历不存在' });
      return;
    }

    const appointment = appointmentModel.findById(record.appointmentId);
    if (!appointment) {
      res.status(404).json({ error: '预约不存在' });
      return;
    }

    for (const item of items) {
      const result = inventoryModel.updateQuantity(
        appointment.storeId,
        item.medicineId,
        -item.quantity
      );
      if (!result || result.quantity < 0) {
        res.status(400).json({ error: `${item.medicine?.name || '药品'}库存不足` });
        return;
      }
    }

    const dispenseRecord = dispenseRecordModel.create({
      prescriptionId: req.params.id,
      pharmacistId: req.user.id
    });

    prescriptionModel.updateStatus(req.params.id, 'dispensed');

    const qrCodeUrl = await generateQRCode(`pickup:${dispenseRecord.pickupCode}`);

    await sendNotification(
      appointment.ownerId,
      'prescription',
      '药品已配好',
      `您的药品已配好，取药码：${dispenseRecord.pickupCode}。请凭取药码前往药房领取。`,
      prescription.id
    );

    res.json({
      ...dispenseRecord,
      qrCodeUrl
    });
  } catch (error) {
    console.error('配药失败:', error);
    res.status(500).json({ error: '配药失败' });
  }
});

router.get('/inventory', authMiddleware, requireRole('pharmacist', 'manager'), requireStoreAccess, (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user?.storeId) {
      res.status(400).json({ error: '请选择门店' });
      return;
    }

    const { lowStock } = req.query;
    let inventory;

    if (lowStock === 'true') {
      inventory = inventoryModel.findLowStock(req.user.storeId);
    } else {
      inventory = inventoryModel.findByStoreId(req.user.storeId);
    }

    res.json(inventory);
  } catch (error) {
    console.error('获取库存列表失败:', error);
    res.status(500).json({ error: '获取库存列表失败' });
  }
});

router.put('/inventory/:medicineId', authMiddleware, requireRole('pharmacist', 'manager'), requireStoreAccess, (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user?.storeId) {
      res.status(400).json({ error: '请选择门店' });
      return;
    }

    const { quantity } = req.body;
    if (quantity === undefined) {
      res.status(400).json({ error: '请提供库存数量' });
      return;
    }

    const updated = inventoryModel.setQuantity(
      req.user.storeId,
      req.params.medicineId,
      parseInt(quantity)
    );

    res.json(updated);
  } catch (error) {
    console.error('更新库存失败:', error);
    res.status(500).json({ error: '更新库存失败' });
  }
});

router.get('/medicines', authMiddleware, (req: AuthRequest, res: Response): void => {
  try {
    const { category, name } = req.query;
    let medicines;

    if (category) {
      medicines = medicineModel.findByCategory(category as string);
    } else if (name) {
      medicines = medicineModel.searchByName(name as string);
    } else {
      medicines = medicineModel.findAll();
    }

    res.json(medicines);
  } catch (error) {
    console.error('获取药品列表失败:', error);
    res.status(500).json({ error: '获取药品列表失败' });
  }
});

router.get('/medicines/substitutes/:medicineId', authMiddleware, (req: AuthRequest, res: Response): void => {
  try {
    const { storeId } = req.query;
    if (!storeId) {
      res.status(400).json({ error: '请提供门店ID' });
      return;
    }

    const substitutes = inventoryModel.getSubstitutes(storeId as string, req.params.medicineId);
    res.json(substitutes);
  } catch (error) {
    console.error('获取替代药品失败:', error);
    res.status(500).json({ error: '获取替代药品失败' });
  }
});

export default router;
