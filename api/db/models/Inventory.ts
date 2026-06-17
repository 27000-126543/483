import { BaseModel } from './BaseModel.js';
import { Inventory } from '../../../shared/types.js';
import { executeQuery, fetchAll, fetchOne } from '../database.js';
import { medicineModel } from './Medicine.js';

export class InventoryModel extends BaseModel<Inventory> {
  protected tableName = 'inventory';

  protected fromRow(row: any): Inventory {
    const medicine = medicineModel.findById(row.medicine_id);
    return {
      id: row.id,
      storeId: row.store_id,
      medicineId: row.medicine_id,
      medicine: medicine || undefined,
      quantity: row.quantity,
      minStock: row.min_stock,
      lastUpdated: row.last_updated
    };
  }

  create(data: Omit<Inventory, 'id' | 'lastUpdated'>): Inventory {
    const id = this.generateId();
    executeQuery(
      'INSERT INTO inventory (id, store_id, medicine_id, quantity, min_stock) VALUES (?, ?, ?, ?, ?)',
      [id, data.storeId, data.medicineId, data.quantity, data.minStock]
    );
    return this.findById(id)!;
  }

  findByStoreAndMedicine(storeId: string, medicineId: string): Inventory | null {
    const row = fetchOne('SELECT * FROM inventory WHERE store_id = ? AND medicine_id = ?', [storeId, medicineId]);
    return row ? this.fromRow(row) : null;
  }

  findByStoreId(storeId: string): Inventory[] {
    return this.findAll('store_id = ?', [storeId]);
  }

  findByMedicineId(medicineId: string): Inventory[] {
    return this.findAll('medicine_id = ?', [medicineId]);
  }

  findLowStock(storeId: string): Inventory[] {
    return this.findAll('store_id = ? AND quantity < min_stock', [storeId]);
  }

  updateQuantity(storeId: string, medicineId: string, quantityChange: number): Inventory | null {
    const existing = this.findByStoreAndMedicine(storeId, medicineId);
    if (!existing) {
      return null;
    }

    const newQuantity = Math.max(0, existing.quantity + quantityChange);
    executeQuery(
      'UPDATE inventory SET quantity = ?, last_updated = CURRENT_TIMESTAMP WHERE store_id = ? AND medicine_id = ?',
      [newQuantity, storeId, medicineId]
    );

    return this.findByStoreAndMedicine(storeId, medicineId);
  }

  setQuantity(storeId: string, medicineId: string, quantity: number): Inventory | null {
    const existing = this.findByStoreAndMedicine(storeId, medicineId);
    if (!existing) {
      return this.create({ storeId, medicineId, quantity, minStock: 10 });
    }

    executeQuery(
      'UPDATE inventory SET quantity = ?, last_updated = CURRENT_TIMESTAMP WHERE store_id = ? AND medicine_id = ?',
      [quantity, storeId, medicineId]
    );

    return this.findByStoreAndMedicine(storeId, medicineId);
  }

  checkAvailability(storeId: string, medicineId: string, quantity: number): { available: boolean; currentStock: number } {
    const inventory = this.findByStoreAndMedicine(storeId, medicineId);
    if (!inventory) {
      return { available: false, currentStock: 0 };
    }
    return {
      available: inventory.quantity >= quantity,
      currentStock: inventory.quantity
    };
  }

  getSubstitutes(storeId: string, medicineId: string): Inventory[] {
    const medicine = medicineModel.findById(medicineId);
    if (!medicine) return [];

    const rows = fetchAll(
      `SELECT i.* FROM inventory i
       JOIN medicines m ON i.medicine_id = m.id
       WHERE i.store_id = ? AND m.category = ? AND m.id != ? AND i.quantity > 0
       ORDER BY i.quantity DESC`,
      [storeId, medicine.category, medicineId]
    );

    return rows.map(row => this.fromRow(row));
  }
}

export const inventoryModel = new InventoryModel();
