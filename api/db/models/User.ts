import { BaseModel } from './BaseModel.js';
import { User, UserRole } from '../../../shared/types.js';
import { executeQuery, fetchAll, fetchOne } from '../database.js';
import bcrypt from 'bcryptjs';

export class UserModel extends BaseModel<User> {
  protected tableName = 'users';

  protected fromRow(row: any): User {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      passwordHash: row.password_hash,
      role: row.role as UserRole,
      storeId: row.store_id,
      memberLevel: row.member_level,
      memberPoints: row.member_points,
      createdAt: row.created_at
    };
  }

  create(data: Omit<User, 'id' | 'createdAt'> & { password: string }): User {
    const id = this.generateId();
    const passwordHash = bcrypt.hashSync(data.password, 10);
    executeQuery(
      `INSERT INTO users (id, name, phone, password_hash, role, store_id, member_level, member_points)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.phone, passwordHash, data.role, data.storeId || null, data.memberLevel || 1, data.memberPoints || 0]
    );
    return this.findById(id)!;
  }

  findByPhone(phone: string): User | null {
    const row = fetchOne('SELECT * FROM users WHERE phone = ?', [phone]);
    return row ? this.fromRow(row) : null;
  }

  findByPhoneAndRole(phone: string, role: string): User | null {
    const row = fetchOne('SELECT * FROM users WHERE phone = ? AND role = ?', [phone, role]);
    return row ? this.fromRow(row) : null;
  }

  verifyPassword(user: User, password: string): boolean {
    return bcrypt.compareSync(password, user.passwordHash || '');
  }

  findByRole(role: UserRole): User[] {
    return this.findAll('role = ?', [role]);
  }

  findByStoreAndRole(storeId: string, role: UserRole): User[] {
    return this.findAll('store_id = ? AND role = ?', [storeId, role]);
  }

  updatePoints(userId: string, pointsChange: number): void {
    executeQuery(
      'UPDATE users SET member_points = member_points + ? WHERE id = ?',
      [pointsChange, userId]
    );
  }

  updateLevel(userId: string, level: number): void {
    executeQuery('UPDATE users SET member_level = ? WHERE id = ?', [level, userId]);
  }

  update(userId: string, data: Partial<User>): User {
    const fields: string[] = [];
    const params: any[] = [];

    if (data.name) {
      fields.push('name = ?');
      params.push(data.name);
    }
    if (data.phone) {
      fields.push('phone = ?');
      params.push(data.phone);
    }
    if (data.storeId !== undefined) {
      fields.push('store_id = ?');
      params.push(data.storeId);
    }
    if (data.memberLevel !== undefined) {
      fields.push('member_level = ?');
      params.push(data.memberLevel);
    }
    if (data.memberPoints !== undefined) {
      fields.push('member_points = ?');
      params.push(data.memberPoints);
    }

    params.push(userId);
    executeQuery(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.findById(userId)!;
  }
}

export const userModel = new UserModel();
