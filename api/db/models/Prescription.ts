import { BaseModel } from './BaseModel.js';
import { Prescription, PrescriptionItem, PrescriptionStatus } from '../../../shared/types.js';
import { executeQuery, fetchAll, fetchOne } from '../database.js';
import { medicineModel } from './Medicine.js';

export class PrescriptionModel extends BaseModel<Prescription> {
  protected tableName = 'prescriptions';

  protected fromRow(row: any): Prescription {
    return {
      id: row.id,
      medicalRecordId: row.medical_record_id,
      status: row.status as PrescriptionStatus,
      needConfirmation: row.need_confirmation === 1,
      createdAt: row.created_at
    };
  }

  create(data: Omit<Prescription, 'id' | 'createdAt'> & { items: Omit<PrescriptionItem, 'id' | 'prescriptionId'>[] }): Prescription {
    const id = this.generateId();
    executeQuery(
      'INSERT INTO prescriptions (id, medical_record_id, status, need_confirmation) VALUES (?, ?, ?, ?)',
      [id, data.medicalRecordId, data.status, data.needConfirmation ? 1 : 0]
    );

    data.items.forEach(item => {
      this.addItem(id, item);
    });

    return this.findById(id)!;
  }

  addItem(prescriptionId: string, item: Omit<PrescriptionItem, 'id' | 'prescriptionId'>): void {
    const id = this.generateId();
    executeQuery(
      `INSERT INTO prescription_items (id, prescription_id, medicine_id, quantity, dosage, frequency, is_substitute, original_medicine_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, prescriptionId, item.medicineId, item.quantity, item.dosage || null, item.frequency || null, item.isSubstitute ? 1 : 0, item.originalMedicineId || null]
    );
  }

  getItems(prescriptionId: string): PrescriptionItem[] {
    const rows = fetchAll('SELECT * FROM prescription_items WHERE prescription_id = ?', [prescriptionId]);
    return rows.map(row => {
      const medicine = medicineModel.findById(row.medicine_id);
      return {
        id: row.id,
        prescriptionId: row.prescription_id,
        medicineId: row.medicine_id,
        medicine: medicine || undefined,
        quantity: row.quantity,
        dosage: row.dosage,
        frequency: row.frequency,
        isSubstitute: row.is_substitute === 1,
        originalMedicineId: row.original_medicine_id
      };
    });
  }

  findByMedicalRecordId(medicalRecordId: string): Prescription | null {
    const row = fetchOne('SELECT * FROM prescriptions WHERE medical_record_id = ?', [medicalRecordId]);
    return row ? this.fromRow(row) : null;
  }

  findByStatus(status: PrescriptionStatus): Prescription[] {
    return this.findAll('status = ?', [status]);
  }

  findByStoreId(storeId: string): Prescription[] {
    const rows = fetchAll(
      `SELECT p.* FROM prescriptions p
       JOIN medical_records mr ON p.medical_record_id = mr.id
       JOIN appointments a ON mr.appointment_id = a.id
       WHERE a.store_id = ?
       ORDER BY p.created_at DESC`,
      [storeId]
    );
    return rows.map(row => this.fromRow(row));
  }

  updateStatus(id: string, status: PrescriptionStatus): Prescription {
    executeQuery('UPDATE prescriptions SET status = ? WHERE id = ?', [status, id]);
    return this.findById(id)!;
  }

  updateNeedConfirmation(id: string, needConfirmation: boolean): Prescription {
    executeQuery('UPDATE prescriptions SET need_confirmation = ? WHERE id = ?', [needConfirmation ? 1 : 0, id]);
    return this.findById(id)!;
  }

  calculateTotal(prescriptionId: string): number {
    const items = this.getItems(prescriptionId);
    return items.reduce((total, item) => {
      return total + (item.medicine?.price || 0) * item.quantity;
    }, 0);
  }

  deleteItem(itemId: string): void {
    executeQuery('DELETE FROM prescription_items WHERE id = ?', [itemId]);
  }
}

export const prescriptionModel = new PrescriptionModel();
