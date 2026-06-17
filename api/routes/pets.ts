import { Router, Response } from 'express';
import { petModel } from '../db/models/Pet.js';
import { AuthRequest, authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, requireRole('owner'), (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const pets = petModel.findByOwnerId(req.user.id);
    res.json(pets);
  } catch (error) {
    console.error('获取宠物列表失败:', error);
    res.status(500).json({ error: '获取宠物列表失败' });
  }
});

router.post('/', authMiddleware, requireRole('owner'), (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const { name, species, breed, age, weight, gender } = req.body;

    if (!name || !species) {
      res.status(400).json({ error: '请填写宠物名称和种类' });
      return;
    }

    const pet = petModel.create({
      ownerId: req.user.id,
      name,
      species,
      breed,
      age,
      weight,
      gender
    });

    res.status(201).json(pet);
  } catch (error) {
    console.error('添加宠物失败:', error);
    res.status(500).json({ error: '添加宠物失败' });
  }
});

router.get('/:id', authMiddleware, requireRole('owner'), (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const pet = petModel.findById(req.params.id);
    if (!pet) {
      res.status(404).json({ error: '宠物不存在' });
      return;
    }

    if (pet.ownerId !== req.user.id) {
      res.status(403).json({ error: '无权访问此宠物信息' });
      return;
    }

    res.json(pet);
  } catch (error) {
    console.error('获取宠物信息失败:', error);
    res.status(500).json({ error: '获取宠物信息失败' });
  }
});

router.put('/:id', authMiddleware, requireRole('owner'), (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const pet = petModel.findById(req.params.id);
    if (!pet) {
      res.status(404).json({ error: '宠物不存在' });
      return;
    }

    if (pet.ownerId !== req.user.id) {
      res.status(403).json({ error: '无权修改此宠物信息' });
      return;
    }

    const { name, species, breed, age, weight, gender } = req.body;
    const updatedPet = petModel.update(req.params.id, {
      name,
      species,
      breed,
      age,
      weight,
      gender
    });

    res.json(updatedPet);
  } catch (error) {
    console.error('更新宠物信息失败:', error);
    res.status(500).json({ error: '更新宠物信息失败' });
  }
});

router.delete('/:id', authMiddleware, requireRole('owner'), (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }

    const pet = petModel.findById(req.params.id);
    if (!pet) {
      res.status(404).json({ error: '宠物不存在' });
      return;
    }

    if (pet.ownerId !== req.user.id) {
      res.status(403).json({ error: '无权删除此宠物' });
      return;
    }

    petModel.delete(req.params.id);
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除宠物失败:', error);
    res.status(500).json({ error: '删除宠物失败' });
  }
});

export default router;
