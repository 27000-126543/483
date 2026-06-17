import { BaseModel } from './BaseModel.js';
import { Appointment, AppointmentStatus } from '../../../shared/types.js';
import { executeQuery, fetchAll, fetchOne } from '../database.js';

export class AppointmentModel extends BaseModel<Appointment> {
  protected tableName = 'appointments';

  protected fromRow(row: any): Appointment {
    return {
      id: row.id,
      ownerId: row.owner_id,
      petId: row.pet_id,
      storeId: row.store_id,
      doctorId: row.doctor_id,
      department: row.department,
      symptoms: row.symptoms,
      appointmentCode: row.appointment_code,
      appointmentTime: row.appointment_time,
      status: row.status as AppointmentStatus,
      satisfaction: row.satisfaction,
      createdAt: row.created_at
    };
  }

  create(data: Omit<Appointment, 'id' | 'createdAt' | 'appointmentCode'>): Appointment {
    const id = this.generateId();
    const appointmentCode = this.generateAppointmentCode();
    executeQuery(
      `INSERT INTO appointments (id, owner_id, pet_id, store_id, doctor_id, department, symptoms, appointment_code, appointment_time, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.ownerId, data.petId, data.storeId, data.doctorId || null, data.department, data.symptoms, appointmentCode, data.appointmentTime, data.status || 'pending']
    );
    return this.findById(id)!;
  }

  private generateAppointmentCode(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `APT${dateStr}${random}`;
  }

  findByOwnerId(ownerId: string): Appointment[] {
    return this.findAll('owner_id = ?', [ownerId]);
  }

  findByDoctorId(doctorId: string): Appointment[] {
    return this.findAll('doctor_id = ?', [doctorId]);
  }

  findByStoreId(storeId: string): Appointment[] {
    return this.findAll('store_id = ?', [storeId]);
  }

  findByDate(date: string, storeId?: string): Appointment[] {
    const where = storeId ? 'DATE(appointment_time) = ? AND store_id = ?' : 'DATE(appointment_time) = ?';
    const params = storeId ? [date, storeId] : [date];
    return this.findAll(where, params);
  }

  findByCode(code: string): Appointment | null {
    const row = fetchOne('SELECT * FROM appointments WHERE appointment_code = ?', [code]);
    return row ? this.fromRow(row) : null;
  }

  updateStatus(id: string, status: AppointmentStatus): Appointment {
    executeQuery('UPDATE appointments SET status = ? WHERE id = ?', [status, id]);
    return this.findById(id)!;
  }

  updateSatisfaction(id: string, satisfaction: number): Appointment {
    executeQuery('UPDATE appointments SET satisfaction = ? WHERE id = ?', [satisfaction, id]);
    return this.findById(id)!;
  }

  updateDoctor(id: string, doctorId: string): Appointment {
    executeQuery('UPDATE appointments SET doctor_id = ? WHERE id = ?', [doctorId, id]);
    return this.findById(id)!;
  }

  getTodayCount(storeId: string): number {
    const row = fetchOne(
      'SELECT COUNT(*) as count FROM appointments WHERE store_id = ? AND DATE(appointment_time) = DATE()',
      [storeId]
    );
    return row?.count || 0;
  }

  getStatisticsByDateRange(startDate: string, endDate: string, storeId?: string) {
    const where = storeId
      ? 'WHERE appointment_time >= ? AND appointment_time <= ? AND store_id = ?'
      : 'WHERE appointment_time >= ? AND appointment_time <= ?';
    const params = storeId ? [startDate, endDate, storeId] : [startDate, endDate];

    const rows = fetchAll(
      `SELECT DATE(appointment_time) as date, status, COUNT(*) as count
       FROM appointments ${where}
       GROUP BY DATE(appointment_time), status`,
      params
    );
    return rows;
  }
}

export const appointmentModel = new AppointmentModel();
