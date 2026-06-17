import { Router, Response } from 'express';
import { appointmentModel } from '../db/models/Appointment.js';
import { departmentModel } from '../db/models/Department.js';
import { AuthRequest, authMiddleware, requireRole, requireStoreAccess } from '../middleware/auth.js';
import { sendNotification } from '../services/socket.js';
import { generateQRCode } from '../services/utils.js';
import { userModel } from '../db/models/User.js';
import { CreateAppointmentRequest, MatchResult } from '../../shared/types.js';

const router = Router();

router.get('/match', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { symptoms, storeId } = req.query;

    if (!symptoms || !storeId) {
      res.status(400).json({ error: '请提供症状描述和门店ID' });
      return;
    }

    const department = departmentModel.matchBySymptoms(symptoms as string);
    if (!department) {
      res.status(404).json({ error: '未找到匹配的科室' });
      return;
    }

    const specialties = departmentModel.getDoctorSpecialties(department.id);
    const doctorsInStore = userModel.findByStoreAndRole(storeId as string, 'doctor');

    const matchedDoctors = specialties
      .filter(spec => doctorsInStore.some(d => d.id === spec.doctorId))
      .map(spec => {
        const doctor = doctorsInStore.find(d => d.id === spec.doctorId)!;
        return {
          id: doctor.id,
          name: doctor.name,
          specialty: department.name,
          rating: spec.rating
        };
      })
      .sort((a, b) => b.rating - a.rating);

    const result: MatchResult = {
      department: department.name,
      departmentId: department.id,
      doctors: matchedDoctors
    };

    res.json(result);
  } catch (error) {
    console.error('匹配科室医生失败:', error);
    res.status(500).json({ error: '匹配科室医生失败' });
  }
});

router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    let appointments;
    if (req.user.role === 'owner') {
      appointments = appointmentModel.findByOwnerId(req.user.id);
    } else if (req.user.role === 'doctor') {
      appointments = appointmentModel.findByDoctorId(req.user.id);
    } else if (req.user.storeId) {
      appointments = appointmentModel.findByStoreId(req.user.storeId);
    } else {
      appointments = appointmentModel.findAll();
    }

    const appointmentsWithQR = await Promise.all(
      appointments.map(async apt => {
        const qrCodeUrl = await generateQRCode(`appointment:${apt.appointmentCode}`);
        return { ...apt, qrCodeUrl };
      })
    );

    res.json(appointmentsWithQR);
  } catch (error) {
    console.error('获取预约列表失败:', error);
    res.status(500).json({ error: '获取预约列表失败' });
  }
});

router.get('/today', authMiddleware, requireRole('doctor', 'manager', 'pharmacist'), requireStoreAccess, (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user?.storeId) {
      res.status(400).json({ error: '请选择门店' });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const appointments = appointmentModel.findByDate(today, req.user.storeId);
    res.json(appointments);
  } catch (error) {
    console.error('获取今日预约失败:', error);
    res.status(500).json({ error: '获取今日预约失败' });
  }
});

router.post('/', authMiddleware, requireRole('owner'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const { petId, storeId, symptoms, appointmentTime }: CreateAppointmentRequest = req.body;

    if (!petId || !storeId || !symptoms || !appointmentTime) {
      res.status(400).json({ error: '请填写完整的预约信息' });
      return;
    }

    const department = departmentModel.matchBySymptoms(symptoms);
    if (!department) {
      res.status(404).json({ error: '未找到匹配的科室' });
      return;
    }

    let autoDoctorId: string | undefined;
    let autoDoctorName: string | undefined;

    const specialties = departmentModel.getDoctorSpecialties(department.id);
    const doctorsInStore = userModel.findByStoreAndRole(storeId, 'doctor');

    const matchedDoctors = specialties
      .filter(spec => doctorsInStore.some(d => d.id === spec.doctorId))
      .map(spec => {
        const doctor = doctorsInStore.find(d => d.id === spec.doctorId)!;
        return { id: doctor.id, name: doctor.name, rating: spec.rating };
      })
      .sort((a, b) => b.rating - a.rating);

    if (matchedDoctors.length > 0) {
      autoDoctorId = matchedDoctors[0].id;
      autoDoctorName = matchedDoctors[0].name;
    }

    const appointment = appointmentModel.create({
      ownerId: req.user.id,
      petId,
      storeId,
      doctorId: autoDoctorId,
      department: department.name,
      symptoms,
      appointmentTime,
      status: 'confirmed'
    });

    const qrCodeUrl = await generateQRCode(`appointment:${appointment.appointmentCode}`);

    await sendNotification(
      req.user.id,
      'appointment',
      '预约成功',
      `您已成功预约${department.name}${autoDoctorName ? '，主治医师：' + autoDoctorName : ''}，就诊码：${appointment.appointmentCode}。请准时就诊。`,
      appointment.id
    );

    if (autoDoctorId) {
      const ownerUser = userModel.findById(req.user.id);
      await sendNotification(
        autoDoctorId,
        'appointment',
        '新的预约',
        `您有一个新的${department.name}预约，宠物主人：${ownerUser?.name || '未知'}，症状：${symptoms}，请及时查看。`,
        appointment.id
      );
    }

    res.status(201).json({ ...appointment, qrCodeUrl });
  } catch (error) {
    console.error('创建预约失败:', error);
    res.status(500).json({ error: '创建预约失败' });
  }
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const appointment = appointmentModel.findById(req.params.id);
    if (!appointment) {
      res.status(404).json({ error: '预约不存在' });
      return;
    }

    if (req.user.role === 'owner' && appointment.ownerId !== req.user.id) {
      res.status(403).json({ error: '无权访问此预约' });
      return;
    }

    if (req.user.role === 'doctor' && appointment.doctorId !== req.user.id) {
      res.status(403).json({ error: '无权访问此预约' });
      return;
    }

    if ((req.user.role === 'pharmacist' || req.user.role === 'manager') &&
        req.user.storeId && appointment.storeId !== req.user.storeId) {
      res.status(403).json({ error: '无权访问此预约' });
      return;
    }

    const qrCodeUrl = await generateQRCode(`appointment:${appointment.appointmentCode}`);
    res.json({ ...appointment, qrCodeUrl });
  } catch (error) {
    console.error('获取预约详情失败:', error);
    res.status(500).json({ error: '获取预约详情失败' });
  }
});

router.put('/:id/status', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const appointment = appointmentModel.findById(req.params.id);
    if (!appointment) {
      res.status(404).json({ error: '预约不存在' });
      return;
    }

    const { status } = req.body;

    if (req.user.role === 'owner' && appointment.ownerId !== req.user.id) {
      res.status(403).json({ error: '无权修改此预约' });
      return;
    }

    if (req.user.role === 'doctor' && appointment.doctorId !== req.user.id) {
      res.status(403).json({ error: '无权修改此预约' });
      return;
    }

    const updated = appointmentModel.updateStatus(req.params.id, status);

    if (status === 'cancelled' || status === 'completed') {
      await sendNotification(
        appointment.ownerId,
        'appointment',
        status === 'cancelled' ? '预约已取消' : '就诊完成',
        status === 'cancelled'
          ? `您的预约（就诊码：${appointment.appointmentCode}）已取消。`
          : `您的就诊已完成（就诊码：${appointment.appointmentCode}）。请及时支付费用。`,
        appointment.id
      );
    }

    res.json(updated);
  } catch (error) {
    console.error('更新预约状态失败:', error);
    res.status(500).json({ error: '更新预约状态失败' });
  }
});

router.put('/:id/satisfaction', authMiddleware, requireRole('owner'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const appointment = appointmentModel.findById(req.params.id);
    if (!appointment || appointment.ownerId !== req.user.id) {
      res.status(403).json({ error: '无权评价此预约' });
      return;
    }

    const { satisfaction } = req.body;
    if (!satisfaction || satisfaction < 1 || satisfaction > 5) {
      res.status(400).json({ error: '请输入1-5之间的评分' });
      return;
    }

    const updated = appointmentModel.updateSatisfaction(req.params.id, satisfaction);
    res.json(updated);
  } catch (error) {
    console.error('提交评价失败:', error);
    res.status(500).json({ error: '提交评价失败' });
  }
});

export default router;
