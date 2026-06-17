import { Router, Response } from 'express';
import { messageModel } from '../db/models/Message.js';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const { unread, type } = req.query;
    let messages;

    if (type) {
      messages = messageModel.findByType(req.user.id, type as any);
    } else if (unread === 'true') {
      messages = messageModel.findByUserId(req.user.id, true);
    } else {
      messages = messageModel.findByUserId(req.user.id);
    }

    res.json(messages);
  } catch (error) {
    console.error('获取消息列表失败:', error);
    res.status(500).json({ error: '获取消息列表失败' });
  }
});

router.get('/unread-count', authMiddleware, (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const count = messageModel.getUnreadCount(req.user.id);
    res.json({ count });
  } catch (error) {
    console.error('获取未读消息数失败:', error);
    res.status(500).json({ error: '获取未读消息数失败' });
  }
});

router.put('/:id/read', authMiddleware, (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const message = messageModel.findById(req.params.id);
    if (!message || message.userId !== req.user.id) {
      res.status(403).json({ error: '无权标记此消息' });
      return;
    }

    const updated = messageModel.markAsRead(req.params.id);
    res.json(updated);
  } catch (error) {
    console.error('标记消息已读失败:', error);
    res.status(500).json({ error: '标记消息已读失败' });
  }
});

router.put('/read-all', authMiddleware, (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    messageModel.markAllAsRead(req.user.id);
    res.json({ message: '已全部标记为已读' });
  } catch (error) {
    console.error('标记全部已读失败:', error);
    res.status(500).json({ error: '标记全部已读失败' });
  }
});

router.get('/:id', authMiddleware, (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const message = messageModel.findById(req.params.id);
    if (!message || message.userId !== req.user.id) {
      res.status(403).json({ error: '无权访问此消息' });
      return;
    }

    if (!message.isRead) {
      messageModel.markAsRead(req.params.id);
    }

    res.json(message);
  } catch (error) {
    console.error('获取消息详情失败:', error);
    res.status(500).json({ error: '获取消息详情失败' });
  }
});

export default router;
