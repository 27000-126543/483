import { BaseModel } from './BaseModel.js';
import { Report } from '../../../shared/types.js';
import { executeQuery, fetchAll, fetchOne } from '../database.js';

export class ReportModel extends BaseModel<Report> {
  protected tableName = 'reports';

  protected fromRow(row: any): Report {
    return {
      id: row.id,
      storeId: row.store_id,
      type: row.type,
      period: row.period,
      reportDate: row.report_date,
      fileUrl: row.file_url,
      data: row.data,
      createdAt: row.created_at
    };
  }

  create(data: Omit<Report, 'id' | 'createdAt'>): Report {
    const id = this.generateId();
    executeQuery(
      'INSERT INTO reports (id, store_id, type, period, report_date, file_url, data) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, data.storeId || null, data.type, data.period, data.reportDate, data.fileUrl || null, data.data || null]
    );
    return this.findById(id)!;
  }

  findByStoreId(storeId: string): Report[] {
    return this.findAll('store_id = ? OR store_id IS NULL', [storeId]);
  }

  findByType(type: string): Report[] {
    return this.findAll('type = ?', [type]);
  }

  findByDateRange(startDate: string, endDate: string, storeId?: string): Report[] {
    const where = storeId
      ? 'report_date >= ? AND report_date <= ? AND (store_id = ? OR store_id IS NULL)'
      : 'report_date >= ? AND report_date <= ?';
    const params = storeId ? [startDate, endDate, storeId] : [startDate, endDate];
    return this.findAll(where, params);
  }

  generateDailyReport(date: string, storeId?: string) {
    const appointmentStats = fetchAll(
      `SELECT status, COUNT(*) as count
       FROM appointments
       WHERE DATE(appointment_time) = ? ${storeId ? 'AND store_id = ?' : ''}
       GROUP BY status`,
      storeId ? [date, storeId] : [date]
    );

    const revenue = fetchOne(
      `SELECT COALESCE(SUM(final_amount), 0) as total
       FROM payments p
       JOIN appointments a ON p.appointment_id = a.id
       WHERE DATE(p.created_at) = ? ${storeId ? 'AND a.store_id = ?' : ''}
       AND p.status = 'paid'`,
      storeId ? [date, storeId] : [date]
    );

    const medicineConsumption = fetchAll(
      `SELECT m.name, SUM(pi.quantity) as total_quantity, SUM(pi.quantity * m.price) as total_amount
       FROM prescription_items pi
       JOIN medicines m ON pi.medicine_id = m.id
       JOIN prescriptions p ON pi.prescription_id = p.id
       JOIN medical_records mr ON p.medical_record_id = mr.id
       JOIN appointments a ON mr.appointment_id = a.id
       WHERE DATE(p.created_at) = ? ${storeId ? 'AND a.store_id = ?' : ''}
       AND p.status = 'dispensed'
       GROUP BY m.id, m.name
       ORDER BY total_quantity DESC`,
      storeId ? [date, storeId] : [date]
    );

    const satisfaction = fetchOne(
      `SELECT AVG(satisfaction) as avg_satisfaction, COUNT(*) as count
       FROM appointments
       WHERE DATE(created_at) = ? ${storeId ? 'AND store_id = ?' : ''}
       AND satisfaction IS NOT NULL`,
      storeId ? [date, storeId] : [date]
    );

    const reportData = {
      date,
      storeId,
      appointments: {
        total: appointmentStats.reduce((sum: number, s: any) => sum + s.count, 0),
        byStatus: appointmentStats,
      },
      revenue: revenue?.total || 0,
      medicineConsumption,
      satisfaction: {
        average: satisfaction?.avg_satisfaction || 0,
        count: satisfaction?.count || 0
      },
      generatedAt: new Date().toISOString()
    };

    return this.create({
      storeId,
      type: 'daily',
      period: 'day',
      reportDate: date,
      data: JSON.stringify(reportData)
    });
  }

  getSatisfactionRanking(storeId: string, startDate: string, endDate: string) {
    const rows = fetchAll(
      `SELECT a.doctor_id, u.name as doctor_name,
              AVG(a.satisfaction) as avg_satisfaction,
              COUNT(*) as appointment_count
       FROM appointments a
       JOIN users u ON a.doctor_id = u.id
       WHERE a.store_id = ?
       AND a.appointment_time >= ?
       AND a.appointment_time <= ?
       AND a.satisfaction IS NOT NULL
       AND a.doctor_id IS NOT NULL
       GROUP BY a.doctor_id, u.name
       ORDER BY avg_satisfaction DESC, appointment_count DESC`,
      [storeId, startDate, endDate]
    );
    return rows.map((row: any) => ({
      doctorId: row.doctor_id,
      doctorName: row.doctor_name,
      avgSatisfaction: row.avg_satisfaction,
      appointmentCount: row.appointment_count
    }));
  }

  getMedicineConsumptionReport(storeId: string, startDate: string, endDate: string) {
    const rows = fetchAll(
      `SELECT m.id, m.name, m.category,
              SUM(pi.quantity) as total_quantity,
              SUM(pi.quantity * m.price) as total_amount
       FROM prescription_items pi
       JOIN medicines m ON pi.medicine_id = m.id
       JOIN prescriptions p ON pi.prescription_id = p.id
       JOIN medical_records mr ON p.medical_record_id = mr.id
       JOIN appointments a ON mr.appointment_id = a.id
       WHERE a.store_id = ?
       AND p.created_at >= ?
       AND p.created_at <= ?
       AND p.status = 'dispensed'
       GROUP BY m.id, m.name, m.category
       ORDER BY total_quantity DESC`,
      [storeId, startDate, endDate]
    );
    return rows;
  }
}

export const reportModel = new ReportModel();
