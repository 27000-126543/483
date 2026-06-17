import { BaseModel } from './BaseModel.js';
import { Medicine } from '../../../shared/types.js';
import { executeQuery } from '../database.js';

export class MedicineModel extends BaseModel<Medicine> {
  protected tableName = 'medicines';

  protected fromRow(row: any): Medicine {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      specification: row.specification,
      manufacturer: row.manufacturer,
      price: row.price,
      description: row.description,
      createdAt: row.created_at
    };
  }

  create(data: Omit<Medicine, 'id' | 'createdAt'>): Medicine {
    const id = this.generateId();
    executeQuery(
      'INSERT INTO medicines (id, name, category, specification, manufacturer, price, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, data.name, data.category, data.specification || null, data.manufacturer || null, data.price, data.description || null]
    );
    return this.findById(id)!;
  }

  findByCategory(category: string): Medicine[] {
    return this.findAll('category = ?', [category]);
  }

  searchByName(name: string): Medicine[] {
    return this.findAll('name LIKE ?', [`%${name}%`]);
  }

  findSubstitutes(medicineId: string): Medicine[] {
    const medicine = this.findById(medicineId);
    if (!medicine) return [];
    return this.findAll('category = ? AND id != ?', [medicine.category, medicineId]);
  }

  update(id: string, data: Partial<Medicine>): Medicine {
    const fields: string[] = [];
    const params: any[] = [];

    if (data.name) {
      fields.push('name = ?');
      params.push(data.name);
    }
    if (data.category) {
      fields.push('category = ?');
      params.push(data.category);
    }
    if (data.specification !== undefined) {
      fields.push('specification = ?');
      params.push(data.specification);
    }
    if (data.manufacturer !== undefined) {
      fields.push('manufacturer = ?');
      params.push(data.manufacturer);
    }
    if (data.price !== undefined) {
      fields.push('price = ?');
      params.push(data.price);
    }
    if (data.description !== undefined) {
      fields.push('description = ?');
      params.push(data.description);
    }

    params.push(id);
    executeQuery(`UPDATE medicines SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.findById(id)!;
  }
}

export const medicineModel = new MedicineModel();
