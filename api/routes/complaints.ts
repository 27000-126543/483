import { Router, Response } from 'express';
import { complaintModel } from '../db/models/Complaint.js';
import { appointmentModel } from '../db/models/Appointment.js';
import { AuthRequest, authMiddleware, requireRole, requireStoreAccess } from '../middleware/auth.js';
import { sendNotification } from '../services/socket.js';
import { CreateComplaintRequest, ResolveComplaintRequest, CloseComplaintRequest } from '../../shared/types.js';

const router = Router();

router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    let complaints;

    if (req.user.role === 'owner') {
      complaints = complaintModel.findByOwnerId(req.user.id);
    } else if (req.user.role === 'manager' && req.user.storeId) {
      complaints = complaintModel.findByStoreId(req.user.storeId);
    } else {
      res.status(403).json({ error: '权限不足' });
      return;
    }

    const complaintsWithResponses = complaints.map(c => ({
      ...c,
      responses: complaintModel.getResponses(c.id)
    }));

    res.json(complaintsWithResponses);
  } catch (error) {
    console.error('获取投诉列表失败:', error);
    res.status(500).json({ error: '获取投诉列表失败' });
  }
});

router.post('/', authMiddleware, requireRole('owner'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const { type, title, content, evidenceUrls, appointmentId }: CreateComplaintRequest & { appointmentId?: string } = req.body;

    if (!type || !title || !content) {
      res.status(400).json({ error: '请填写完整的投诉信息' });
      return;
    }

    let storeId: string;
    if (appointmentId) {
      const appointment = appointmentModel.findById(appointmentId);
      if (!appointment || appointment.ownerId !== req.user.id) {
        res.status(400).json({ error: '预约不存在或无权投诉' });
        return;
      }
      storeId = appointment.storeId;
    } else {
      const appointments = appointmentModel.findByOwnerId(req.user.id);
      if (appointments.length === 0) {
        res.status(400).json({ error: '请提供关联的预约ID' });
        return;
      }
      storeId = appointments[0].storeId;
    }

    const complaint = complaintModel.create({
      ownerId: req.user.id,
      storeId,
      type,
      title,
      content,
      evidenceUrls: evidenceUrls as any
    });

    complaintModel.autoAssign(complaint.id, storeId);

    await sendNotification(
      req.user.id,
      'complaint',
      '投诉已受理',
      '您的投诉已受理，我们将尽快处理并回复您。',
      complaint.id
    );

    const assignedComplaint = complaintModel.findById(complaint.id);
    if (assignedComplaint?.managerId) {
      await sendNotification(
        assignedComplaint.managerId,
        'complaint',
        '新的投诉',
        `您有一条新的投诉需要处理：${title}`,
        complaint.id
      );
    }

    res.status(201).json(assignedComplaint || complaint);
  } catch (error) {
    console.error('提交投诉失败:', error);
    res.status(500).json({ error: '提交投诉失败' });
  }
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const complaint = complaintModel.findById(req.params.id);
    if (!complaint) {
      res.status(404).json({ error: '投诉不存在' });
      return;
    }

    if (req.user.role === 'owner' && complaint.ownerId !== req.user.id) {
      res.status(403).json({ error: '无权访问此投诉' });
      return;
    }

    if (req.user.role === 'manager' && req.user.storeId && complaint.storeId !== req.user.storeId) {
      res.status(403).json({ error: '无权访问此投诉' });
      return;
    }

    const responses = complaintModel.getResponses(req.params.id);
    res.json({ ...complaint, responses });
  } catch (error) {
    console.error('获取投诉详情失败:', error);
    res.status(500).json({ error: '获取投诉详情失败' });
  }
});

router.put('/:id/respond', authMiddleware, requireRole('manager'), requireStoreAccess, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const complaint = complaintModel.findById(req.params.id);
    if (!complaint) {
      res.status(404).json({ error: '投诉不存在' });
      return;
    }

    const { response }: ResolveComplaintRequest = req.body;
    if (!response) {
      res.status(400).json({ error: '请输入回复内容' });
      return;
    }

    complaintModel.updateStatus(req.params.id, 'processing');

    const complaintResponse = complaintModel.addResponse({
      complaintId: req.params.id,
      responderId: req.user.id,
      content: response
    });

    complaintModel.updateStatus(req.params.id, 'resolved');

    await sendNotification(
      complaint.ownerId,
      'complaint',
      '投诉已处理',
      '您的投诉已处理完成，请查看处理结果并确认。',
      complaint.id
    );

    res.json(complaintResponse);
  } catch (error) {
    console.error('回复投诉失败:', error);
    res.status(500).json({ error: '回复投诉失败' });
  }
});

router.put('/:id/close', authMiddleware, requireRole('owner'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const complaint = complaintModel.findById(req.params.id);
    if (!complaint || complaint.ownerId !== req.user.id) {
      res.status(403).json({ error: '无权关闭此投诉' });
      return;
    }

    const { satisfaction }: CloseComplaintRequest = req.body;
    if (satisfaction && (satisfaction < 1 || satisfaction > 5)) {
      res.status(400).json({ error: '请输入1-5之间的评分' });
      return;
    }

    if (satisfaction) {
      complaintModel.updateSatisfaction(req.params.id, satisfaction);
    }

    const updated = complaintModel.updateStatus(req.params.id, 'closed');

    await sendNotification(
      req.user.id,
      'complaint',
      '投诉已关闭',
      '感谢您的反馈，我们将持续改进服务质量。',
      complaint.id
    );

    if (complaint.managerId) {
      await sendNotification(
        complaint.managerId,
        'complaint',
        '投诉已确认关闭',
        `投诉「${complaint.title}」已由用户确认关闭。`,
        complaint.id
      );
    }

    res.json(updated);
  } catch (error) {
    console.error('关闭投诉失败:', error);
    res.status(500).json({ error: '关闭投诉失败' });
  }
});

export default router;
