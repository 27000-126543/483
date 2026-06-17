import { BaseModel } from './BaseModel.js';
import { Payment, PaymentStatus, MemberTransaction, MemberTransactionType } from '../../../shared/types.js';
import { executeQuery, fetchOne, fetchAll } from '../database.js';
import { userModel } from './User.js';

export class PaymentModel extends BaseModel<Payment> {
  protected tableName = 'payments';

  protected fromRow(row: any): Payment {
    return {
      id: row.id,
      appointmentId: row.appointment_id,
      originalAmount: row.original_amount,
      memberDiscount: row.member_discount,
      pointsDeduction: row.points_deduction,
      finalAmount: row.final_amount,
      paymentMethod: row.payment_method,
      status: row.status as PaymentStatus,
      paidAt: row.paid_at,
      createdAt: row.created_at
    };
  }

  create(data: Omit<Payment, 'id' | 'createdAt'>): Payment {
    const id = this.generateId();
    executeQuery(
      `INSERT INTO payments (id, appointment_id, original_amount, member_discount, points_deduction, final_amount, payment_method, status, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.appointmentId, data.originalAmount, data.memberDiscount, data.pointsDeduction, data.finalAmount, data.paymentMethod || null, data.status, data.paidAt || null]
    );
    return this.findById(id)!;
  }

  findByAppointmentId(appointmentId: string): Payment | null {
    const row = fetchOne('SELECT * FROM payments WHERE appointment_id = ?', [appointmentId]);
    return row ? this.fromRow(row) : null;
  }

  findByOwnerId(ownerId: string): Payment[] {
    const rows = fetchAll(
      `SELECT p.* FROM payments p
       JOIN appointments a ON p.appointment_id = a.id
       WHERE a.owner_id = ?
       ORDER BY p.created_at DESC`,
      [ownerId]
    );
    return rows.map(row => this.fromRow(row));
  }

  updateStatus(id: string, status: PaymentStatus, paidAt?: string): Payment {
    if (paidAt) {
      executeQuery('UPDATE payments SET status = ?, paid_at = ? WHERE id = ?', [status, paidAt, id]);
    } else {
      executeQuery('UPDATE payments SET status = ? WHERE id = ?', [status, id]);
    }
    return this.findById(id)!;
  }

  calculateMemberDiscount(amount: number, memberLevel: number): number {
    const discountRates: Record<number, number> = {
      1: 0,
      2: 0.05,
      3: 0.10,
      4: 0.15,
      5: 0.20
    };
    const rate = discountRates[memberLevel] || 0;
    return Math.round(amount * rate * 100) / 100;
  }

  calculatePointsDeduction(points: number): number {
    return Math.floor(points / 100);
  }

  calculateEarnedPoints(amount: number): number {
    return Math.floor(amount);
  }

  addTransaction(data: Omit<MemberTransaction, 'id' | 'createdAt'>): MemberTransaction {
    const id = this.generateId();
    executeQuery(
      'INSERT INTO member_transactions (id, user_id, payment_id, type, points_change, balance_after, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, data.userId, data.paymentId || null, data.type, data.pointsChange, data.balanceAfter, data.description || null]
    );

    const row = fetchOne('SELECT * FROM member_transactions WHERE id = ?', [id]);
    return {
      id: row.id,
      userId: row.user_id,
      paymentId: row.payment_id,
      type: row.type as MemberTransactionType,
      pointsChange: row.points_change,
      balanceAfter: row.balance_after,
      description: row.description,
      createdAt: row.created_at
    };
  }

  getTransactions(userId: string): MemberTransaction[] {
    const rows = fetchAll('SELECT * FROM member_transactions WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      paymentId: row.payment_id,
      type: row.type as MemberTransactionType,
      pointsChange: row.points_change,
      balanceAfter: row.balance_after,
      description: row.description,
      createdAt: row.created_at
    }));
  }

  getRevenueByDateRange(startDate: string, endDate: string, storeId?: string) {
    const where = storeId
      ? 'WHERE p.created_at >= ? AND p.created_at <= ? AND a.store_id = ? AND p.status = "paid"'
      : 'WHERE p.created_at >= ? AND p.created_at <= ? AND p.status = "paid"';
    const params = storeId ? [startDate, endDate, storeId] : [startDate, endDate];

    const rows = fetchAll(
      `SELECT DATE(p.created_at) as date, SUM(p.final_amount) as total
       FROM payments p
       JOIN appointments a ON p.appointment_id = a.id
       ${where}
       GROUP BY DATE(p.created_at)`,
      params
    );
    return rows;
  }
}

export const paymentModel = new PaymentModel();
