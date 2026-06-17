import { v4 as uuidv4 } from 'uuid';
import { fetchOne, fetchAll, executeQuery, getDatabase, saveDatabase } from '../database.js';

export abstract class BaseModel<T> {
  protected abstract tableName: string;

  protected abstract fromRow(row: any): T;

  findById(id: string): T | null {
    const row = fetchOne(`SELECT * FROM ${this.tableName} WHERE id = ?`, [id]);
    return row ? this.fromRow(row) : null;
  }

  findAll(where: string = '', params: any[] = [], orderBy: string = 'created_at DESC'): T[] {
    const sql = `SELECT * FROM ${this.tableName} ${where ? 'WHERE ' + where : ''} ORDER BY ${orderBy}`;
    const rows = fetchAll(sql, params);
    return rows.map(row => this.fromRow(row));
  }

  delete(id: string): void {
    executeQuery(`DELETE FROM ${this.tableName} WHERE id = ?`, [id]);
  }

  protected generateId(): string {
    return uuidv4();
  }
}
