import { BaseModel } from './BaseModel.js';
import { DispenseRecord } from '../../../shared/types.js';
import { executeQuery, fetchOne } from '../database.js';

export class DispenseRecordModel extends BaseModel<DispenseRecord> {
  protected tableName = 'dispense_records';

  protected fromRow(row: any): DispenseRecord {
    return {
      id: row.id,
      prescriptionId: row.prescription_id,
      pharmacistId: row.pharmacist_id,
      pickupCode: row.pickup_code,
      dispensedAt: row.dispensed_at
    };
  }

  create(data: Omit<DispenseRecord, 'id' | 'dispensedAt' | 'pickupCode'>): DispenseRecord {
    const id = this.generateId();
    const pickupCode = this.generatePickupCode();
    executeQuery(
      'INSERT INTO dispense_records (id, prescription_id, pharmacist_id, pickup_code) VALUES (?, ?, ?, ?)',
      [id, data.prescriptionId, data.pharmacistId, pickupCode]
    );
    return this.findById(id)!;
  }

  private generatePickupCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  findByPrescriptionId(prescriptionId: string): DispenseRecord | null {
    const row = fetchOne('SELECT * FROM dispense_records WHERE prescription_id = ?', [prescriptionId]);
    return row ? this.fromRow(row) : null;
  }

  findByPickupCode(pickupCode: string): DispenseRecord | null {
    const row = fetchOne('SELECT * FROM dispense_records WHERE pickup_code = ?', [pickupCode]);
    return row ? this.fromRow(row) : null;
  }

  findByPharmacistId(pharmacistId: string): DispenseRecord[] {
    return this.findAll('pharmacist_id = ?', [pharmacistId]);
  }
}

export const dispenseRecordModel = new DispenseRecordModel();
