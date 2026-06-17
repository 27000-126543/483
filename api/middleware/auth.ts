import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '../../shared/types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'pet-hospital-secret-key';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
    storeId?: string;
  };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: '未提供认证令牌' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      id: decoded.id,
      role: decoded.role,
      storeId: decoded.storeId
    };
    next();
  } catch (error) {
    res.status(401).json({ error: '认证令牌无效或已过期' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: '权限不足，无法访问此资源' });
      return;
    }

    next();
  };
}

export function requireStoreAccess(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: '请先登录' });
    return;
  }

  if (req.user.role === 'owner' || req.user.role === 'admin') {
    next();
    return;
  }

  const storeId = req.params.storeId || req.body.storeId || req.query.storeId;

  if (!storeId) {
    next();
    return;
  }

  if (req.user.storeId && req.user.storeId !== storeId) {
    res.status(403).json({ error: '您只能访问所属门店的数据' });
    return;
  }

  next();
}

export function generateToken(user: { id: string; role: UserRole; storeId?: string }): string {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      storeId: user.storeId
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}
