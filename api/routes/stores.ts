import { Router, Response } from 'express';
import { storeModel } from '../db/models/Store.js';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, (_req: AuthRequest, res: Response): void => {
  try {
    const stores = storeModel.findAll();
    res.json(stores);
  } catch (error) {
    console.error('获取门店列表失败:', error);
    res.status(500).json({ error: '获取门店列表失败' });
  }
});

router.get('/:id', authMiddleware, (req: AuthRequest, res: Response): void => {
  try {
    const store = storeModel.findById(req.params.id);
    if (!store) {
      res.status(404).json({ error: '门店不存在' });
      return;
    }
    res.json(store);
  } catch (error) {
    console.error('获取门店信息失败:', error);
    res.status(500).json({ error: '获取门店信息失败' });
  }
});

router.post('/', authMiddleware, requireRole('admin'), (req: AuthRequest, res: Response): void => {
  try {
    const { name, address, phone } = req.body;

    if (!name || !address || !phone) {
      res.status(400).json({ error: '请填写完整的门店信息' });
      return;
    }

    const store = storeModel.create({ name, address, phone });
    res.status(201).json(store);
  } catch (error) {
    console.error('创建门店失败:', error);
    res.status(500).json({ error: '创建门店失败' });
  }
});

router.put('/:id', authMiddleware, requireRole('admin'), (req: AuthRequest, res: Response): void => {
  try {
    const { name, address, phone } = req.body;
    const store = storeModel.update(req.params.id, { name, address, phone });
    res.json(store);
  } catch (error) {
    console.error('更新门店失败:', error);
    res.status(500).json({ error: '更新门店失败' });
  }
});

function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: '权限不足' });
      return;
    }
    next();
  };
}

export default router;
