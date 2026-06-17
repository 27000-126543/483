import { Router, Response } from 'express';
import { medicalRecordModel } from '../db/models/MedicalRecord.js';
import { prescriptionModel } from '../db/models/Prescription.js';
import { inventoryModel } from '../db/models/Inventory.js';
import { AuthRequest, authMiddleware, requireRole } from '../middleware/auth.js';
import { sendNotification } from '../services/socket.js';
import { CreateMedicalRecordRequest } from '../../shared/types.js';
import { appointmentModel } from '../db/models/Appointment.js';
import { userModel } from '../db/models/User.js';
import { petModel } from '../db/models/Pet.js';

const router = Router();

router.get('/records', authMiddleware, (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    let records: any[];
    if (req.user.role === 'owner') {
      records = medicalRecordModel.findByOwnerId(req.user.id);
    } else if (req.user.role === 'doctor') {
      records = medicalRecordModel.findByDoctorId(req.user.id);
    } else {
      records = medicalRecordModel.findByOwnerId(req.user.id);
    }

    const recordsWithDetails = records.map(record => {
      const prescription = record.prescriptionId
        ? prescriptionModel.findById(record.prescriptionId)
        : null;
      const prescriptionItems = prescription
        ? prescriptionModel.getItems(prescription.id)
        : [];
      const doctor = userModel.findById(record.doctorId);
      const appointment = appointmentModel.findById(record.appointmentId);
      let pet: any = null;
      if (record.petId || appointment?.petId) {
        pet = petModel.findById(record.petId || appointment?.petId);
      }
      return {
        ...record,
        doctorName: doctor?.name,
        petName: pet?.name,
        petId: record.petId || appointment?.petId,
        prescription: prescription ? { ...prescription, items: prescriptionItems } : null
      };
    });

    res.json(recordsWithDetails);
  } catch (error) {
    console.error('获取病历列表失败:', error);
    res.status(500).json({ error: '获取病历列表失败' });
  }
});

router.get('/pet/:petId', authMiddleware, requireRole('owner', 'doctor', 'manager'), (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const records = medicalRecordModel.findByPetId(req.params.petId);

    const recordsWithDetails = records.map(record => {
      const prescription = record.prescriptionId
        ? prescriptionModel.findById(record.prescriptionId)
        : null;
      const prescriptionItems = prescription
        ? prescriptionModel.getItems(prescription.id)
        : [];
      const doctor = userModel.findById(record.doctorId);
      const appointment = appointmentModel.findById(record.appointmentId);
      return {
        ...record,
        doctorName: doctor?.name,
        petName: appointment ? petModel.findById(appointment.petId)?.name : undefined,
        prescription: prescription ? { ...prescription, items: prescriptionItems } : null
      };
    });

    res.json(recordsWithDetails);
  } catch (error) {
    console.error('获取病历记录失败:', error);
    res.status(500).json({ error: '获取病历记录失败' });
  }
});

router.get('/appointment/:appointmentId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const record = medicalRecordModel.findByAppointmentId(req.params.appointmentId);
    if (!record) {
      res.status(404).json({ error: '病历不存在' });
      return;
    }

    const appointment = appointmentModel.findById(req.params.appointmentId);
    if (!appointment) {
      res.status(404).json({ error: '预约不存在' });
      return;
    }

    if (req.user.role === 'owner' && appointment.ownerId !== req.user.id) {
      res.status(403).json({ error: '无权访问此病历' });
      return;
    }

    if (req.user.role === 'doctor' && appointment.doctorId !== req.user.id && record.doctorId !== req.user.id) {
      res.status(403).json({ error: '无权访问此病历' });
      return;
    }

    const prescription = prescriptionModel.findByMedicalRecordId(record.id);
    const prescriptionItems = prescription ? prescriptionModel.getItems(prescription.id) : [];

    res.json({
      ...record,
      prescription: prescription ? { ...prescription, items: prescriptionItems } : null
    });
  } catch (error) {
    console.error('获取病历详情失败:', error);
    res.status(500).json({ error: '获取病历详情失败' });
  }
});

router.post('/', authMiddleware, requireRole('doctor'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const { appointmentId, diagnosis, treatment, notes, prescriptions }: CreateMedicalRecordRequest = req.body;

    if (!appointmentId || !diagnosis || !prescriptions) {
      res.status(400).json({ error: '请填写完整的病历信息' });
      return;
    }

    const appointment = appointmentModel.findById(appointmentId);
    if (!appointment) {
      res.status(404).json({ error: '预约不存在' });
      return;
    }

    if (appointment.doctorId && appointment.doctorId !== req.user.id) {
      res.status(403).json({ error: '您不是该预约的主治医师' });
      return;
    }

    let needConfirmation = false;
    const processedPrescriptions = [];

    for (const item of prescriptions) {
      const checkResult = inventoryModel.checkAvailability(appointment.storeId, item.medicineId, item.quantity);

      if (!checkResult.available) {
        needConfirmation = true;
        const substitutes = inventoryModel.getSubstitutes(appointment.storeId, item.medicineId);
        processedPrescriptions.push({
          ...item,
          outOfStock: true,
          substitutes
        });
      } else {
        processedPrescriptions.push({ ...item, outOfStock: false });
      }
    }

    const record = medicalRecordModel.create({
      appointmentId,
      doctorId: req.user.id,
      diagnosis,
      treatment,
      notes
    });

    const prescription = prescriptionModel.create({
      medicalRecordId: record.id,
      status: needConfirmation ? 'pending' : 'confirmed',
      needConfirmation,
      items: prescriptions.map(p => ({
        medicineId: p.medicineId,
        quantity: p.quantity,
        dosage: p.dosage,
        frequency: p.frequency,
        isSubstitute: false
      }))
    });

    appointmentModel.updateStatus(appointmentId, 'in_progress');

    if (needConfirmation) {
      await sendNotification(
        appointment.ownerId,
        'prescription',
        '处方待确认',
        '部分药品缺货，已为您推荐替代品，请确认处方。',
        prescription.id
      );
    }

    const prescriptionItems = prescriptionModel.getItems(prescription.id);

    res.status(201).json({
      record,
      prescription: {
        ...prescription,
        items: prescriptionItems,
        processedItems: processedPrescriptions
      }
    });
  } catch (error) {
    console.error('创建病历失败:', error);
    res.status(500).json({ error: '创建病历失败' });
  }
});

router.get('/inventory/check', authMiddleware, (req: AuthRequest, res: Response): void => {
  try {
    const { storeId, medicineId, quantity } = req.query;

    if (!storeId || !medicineId || !quantity) {
      res.status(400).json({ error: '请提供完整的查询参数' });
      return;
    }

    const checkResult = inventoryModel.checkAvailability(
      storeId as string,
      medicineId as string,
      parseInt(quantity as string)
    );

    let substitutes = [];
    if (!checkResult.available) {
      substitutes = inventoryModel.getSubstitutes(storeId as string, medicineId as string);
    }

    res.json({
      ...checkResult,
      substitutes
    });
  } catch (error) {
    console.error('检查库存失败:', error);
    res.status(500).json({ error: '检查库存失败' });
  }
});

router.put('/prescriptions/:id/confirm', authMiddleware, requireRole('owner'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const { substituteMedicines } = req.body;
    const prescription = prescriptionModel.findById(req.params.id);

    if (!prescription) {
      res.status(404).json({ error: '处方不存在' });
      return;
    }

    if (substituteMedicines && substituteMedicines.length > 0) {
      for (const sub of substituteMedicines) {
        prescriptionModel.deleteItem(sub.originalId);
        prescriptionModel.addItem(req.params.id, {
          medicineId: sub.substituteId,
          quantity: 1,
          isSubstitute: true,
          originalMedicineId: sub.originalId
        });
      }
    }

    const updated = prescriptionModel.updateStatus(req.params.id, 'confirmed');
    const items = prescriptionModel.getItems(req.params.id);

    const medicalRecord = medicalRecordModel.findById(updated.medicalRecordId);
    if (medicalRecord) {
      const appointment = appointmentModel.findById(medicalRecord.appointmentId);
      if (appointment) {
        await sendNotification(
          appointment.ownerId,
          'prescription',
          '处方已确认',
          '您的处方已确认，等待药剂师审核。',
          updated.id
        );
      }
    }

    res.json({ ...updated, items });
  } catch (error) {
    console.error('确认处方失败:', error);
    res.status(500).json({ error: '确认处方失败' });
  }
});

router.put('/:id/follow-up', authMiddleware, requireRole('doctor'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const { followUpDate, followUpNotes } = req.body;
    const record = medicalRecordModel.findById(req.params.id);

    if (!record) {
      res.status(404).json({ error: '病历不存在' });
      return;
    }

    const appointment = appointmentModel.findById(record.appointmentId);
    if (appointment?.doctorId && appointment.doctorId !== req.user.id) {
      res.status(403).json({ error: '您不是该预约的主治医师' });
      return;
    }

    const updated = medicalRecordModel.update(req.params.id, {
      followUpDate: followUpDate || null,
      followUpNotes: followUpNotes || null
    });

    if (followUpDate && appointment) {
      const pet = petModel.findById(appointment.petId);
      await sendNotification(
        appointment.ownerId,
        'follow_up',
        '复诊提醒已设置',
        `您的宠物${pet?.name || ''}的复诊提醒已设置，建议复诊日期：${new Date(followUpDate).toLocaleDateString('zh-CN')}，请按时复诊。`,
        record.id
      );
    }

    res.json(updated);
  } catch (error) {
    console.error('设置复诊失败:', error);
    res.status(500).json({ error: '设置复诊失败' });
  }
});

export default router;
