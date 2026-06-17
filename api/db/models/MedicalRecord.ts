import { BaseModel } from './BaseModel.js';
import { MedicalRecord } from '../../../shared/types.js';
import { executeQuery, fetchOne } from '../database.js';

export class MedicalRecordModel extends BaseModel<MedicalRecord> {
  protected tableName = 'medical_records';

  protected fromRow(row: any): MedicalRecord {
    return {
      id: row.id,
      appointmentId: row.appointment_id,
      doctorId: row.doctor_id,
      diagnosis: row.diagnosis,
      treatment: row.treatment,
      notes: row.notes,
      createdAt: row.created_at
    };
  }

  create(data: Omit<MedicalRecord, 'id' | 'createdAt'>): MedicalRecord {
    const id = this.generateId();
    executeQuery(
      'INSERT INTO medical_records (id, appointment_id, doctor_id, diagnosis, treatment, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [id, data.appointmentId, data.doctorId, data.diagnosis, data.treatment || null, data.notes || null]
    );
    return this.findById(id)!;
  }

  findByAppointmentId(appointmentId: string): MedicalRecord | null {
    const row = fetchOne('SELECT * FROM medical_records WHERE appointment_id = ?', [appointmentId]);
    return row ? this.fromRow(row) : null;
  }

  findByPetId(petId: string): MedicalRecord[] {
    return this.findAll(
      'mr.appointment_id = a.id AND a.pet_id = ?',
      [petId],
      'mr.created_at DESC'
    );
  }

  findByDoctorId(doctorId: string): MedicalRecord[] {
    return this.findAll('doctor_id = ?', [doctorId]);
  }

  update(id: string, data: Partial<MedicalRecord>): MedicalRecord {
    const fields: string[] = [];
    const params: any[] = [];

    if (data.diagnosis) {
      fields.push('diagnosis = ?');
      params.push(data.diagnosis);
    }
    if (data.treatment !== undefined) {
      fields.push('treatment = ?');
      params.push(data.treatment);
    }
    if (data.notes !== undefined) {
      fields.push('notes = ?');
      params.push(data.notes);
    }

    params.push(id);
    executeQuery(`UPDATE medical_records SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.findById(id)!;
  }
}

export const medicalRecordModel = new MedicalRecordModel();
