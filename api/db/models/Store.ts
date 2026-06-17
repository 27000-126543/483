import { BaseModel } from './BaseModel.js';
import { Store } from '../../../shared/types.js';
import { executeQuery } from '../database.js';

export class StoreModel extends BaseModel<Store> {
  protected tableName = 'stores';

  protected fromRow(row: any): Store {
    return {
      id: row.id,
      name: row.name,
      address: row.address,
      phone: row.phone,
      createdAt: row.created_at
    };
  }

  create(data: Omit<Store, 'id' | 'createdAt'>): Store {
    const id = this.generateId();
    executeQuery(
      'INSERT INTO stores (id, name, address, phone) VALUES (?, ?, ?, ?)',
      [id, data.name, data.address, data.phone]
    );
    return this.findById(id)!;
  }

  update(id: string, data: Partial<Store>): Store {
    const fields: string[] = [];
    const params: any[] = [];

    if (data.name) {
      fields.push('name = ?');
      params.push(data.name);
    }
    if (data.address) {
      fields.push('address = ?');
      params.push(data.address);
    }
    if (data.phone) {
      fields.push('phone = ?');
      params.push(data.phone);
    }

    params.push(id);
    executeQuery(`UPDATE stores SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.findById(id)!;
  }
}

export const storeModel = new StoreModel();
