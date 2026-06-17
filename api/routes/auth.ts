import { Router, Request, Response } from 'express';
import { userModel } from '../db/models/User.js';
import { generateToken, AuthRequest, authMiddleware } from '../middleware/auth.js';
import { LoginRequest, RegisterRequest } from '../../shared/types.js';
import { sendNotification } from '../services/socket.js';

const router = Router();

router.post('/login', (req: Request, res: Response): void => {
  try {
    const { phone, password, role }: LoginRequest = req.body;

    if (!phone || !password || !role) {
      res.status(400).json({ error: '请填写完整的登录信息' });
      return;
    }

    const user = userModel.findByPhoneAndRole(phone, role);
    if (!user) {
      res.status(401).json({ error: '手机号或密码错误' });
      return;
    }

    if (!userModel.verifyPassword(user, password)) {
      res.status(401).json({ error: '手机号或密码错误' });
      return;
    }

    const token = generateToken({
      id: user.id,
      role: user.role,
      storeId: user.storeId
    });

    const { passwordHash, ...userWithoutPassword } = user;

    res.json({
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

router.post('/register', (req: Request, res: Response): void => {
  try {
    const { name, phone, password }: RegisterRequest = req.body;

    if (!name || !phone || !password) {
      res.status(400).json({ error: '请填写完整的注册信息' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: '密码长度不能少于6位' });
      return;
    }

    const existingUser = userModel.findByPhone(phone);
    if (existingUser) {
      res.status(400).json({ error: '该手机号已被注册' });
      return;
    }

    const user = userModel.create({
      name,
      phone,
      password,
      role: 'owner',
      memberLevel: 1,
      memberPoints: 0
    });

    const token = generateToken({
      id: user.id,
      role: user.role
    });

    const { passwordHash, ...userWithoutPassword } = user;

    res.status(201).json({
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

router.get('/me', authMiddleware, (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const user = userModel.findById(req.user.id);
    if (!user) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }

    const { passwordHash, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

router.put('/me', authMiddleware, (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const { name, phone } = req.body;

    if (phone && phone !== req.user.id) {
      const existingUser = userModel.findByPhone(phone);
      if (existingUser && existingUser.id !== req.user.id) {
        res.status(400).json({ error: '该手机号已被使用' });
        return;
      }
    }

    const user = userModel.update(req.user.id, { name, phone });
    const { passwordHash, ...userWithoutPassword } = user;

    res.json(userWithoutPassword);
  } catch (error) {
    console.error('更新用户信息失败:', error);
    res.status(500).json({ error: '更新用户信息失败' });
  }
});

router.get('/doctors', authMiddleware, (req: AuthRequest, res: Response): void => {
  try {
    const { storeId, departmentId } = req.query;
    let doctors;

    if (storeId && departmentId) {
      doctors = userModel.findByStoreAndRole(storeId as string, 'doctor');
    } else {
      doctors = userModel.findByRole('doctor');
    }

    const doctorsWithoutPassword = doctors.map(d => {
      const { passwordHash, ...rest } = d;
      return rest;
    });

    res.json(doctorsWithoutPassword);
  } catch (error) {
    console.error('获取医生列表失败:', error);
    res.status(500).json({ error: '获取医生列表失败' });
  }
});

export default router;
