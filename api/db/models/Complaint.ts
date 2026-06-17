import { BaseModel } from './BaseModel.js';
import { Complaint, ComplaintResponse, ComplaintStatus, ComplaintType } from '../../../shared/types.js';
import { executeQuery, fetchAll, fetchOne } from '../database.js';

export class ComplaintModel extends BaseModel<Complaint> {
  protected tableName = 'complaints';

  protected fromRow(row: any): Complaint {
    return {
      id: row.id,
      ownerId: row.owner_id,
      storeId: row.store_id,
      managerId: row.manager_id,
      type: row.type as ComplaintType,
      title: row.title,
      content: row.content,
      evidenceUrls: row.evidence_urls,
      status: row.status as ComplaintStatus,
      satisfaction: row.satisfaction,
      createdAt: row.created_at
    };
  }

  create(data: Omit<Complaint, 'id' | 'createdAt' | 'status'> & { evidenceUrls?: string[] }): Complaint {
    const id = this.generateId();
    const evidenceUrls = data.evidenceUrls ? JSON.stringify(data.evidenceUrls) : null;
    executeQuery(
      'INSERT INTO complaints (id, owner_id, store_id, type, title, content, evidence_urls, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, data.ownerId, data.storeId, data.type, data.title, data.content, evidenceUrls, 'pending']
    );
    return this.findById(id)!;
  }

  findByOwnerId(ownerId: string): Complaint[] {
    return this.findAll('owner_id = ?', [ownerId]);
  }

  findByStoreId(storeId: string): Complaint[] {
    return this.findAll('store_id = ?', [storeId]);
  }

  findByManagerId(managerId: string): Complaint[] {
    return this.findAll('manager_id = ?', [managerId]);
  }

  findByStatus(status: ComplaintStatus): Complaint[] {
    return this.findAll('status = ?', [status]);
  }

  assignToManager(id: string, managerId: string): Complaint {
    executeQuery('UPDATE complaints SET manager_id = ?, status = "assigned" WHERE id = ?', [managerId, id]);
    return this.findById(id)!;
  }

  updateStatus(id: string, status: ComplaintStatus): Complaint {
    executeQuery('UPDATE complaints SET status = ? WHERE id = ?', [status, id]);
    return this.findById(id)!;
  }

  updateSatisfaction(id: string, satisfaction: number): Complaint {
    executeQuery('UPDATE complaints SET satisfaction = ? WHERE id = ?', [satisfaction, id]);
    return this.findById(id)!;
  }

  addResponse(data: Omit<ComplaintResponse, 'id' | 'createdAt'>): ComplaintResponse {
    const id = this.generateId();
    executeQuery(
      'INSERT INTO complaint_responses (id, complaint_id, responder_id, content) VALUES (?, ?, ?, ?)',
      [id, data.complaintId, data.responderId, data.content]
    );
    const row = fetchOne('SELECT * FROM complaint_responses WHERE id = ?', [id]);
    return {
      id: row.id,
      complaintId: row.complaint_id,
      responderId: row.responder_id,
      content: row.content,
      createdAt: row.created_at
    };
  }

  getResponses(complaintId: string): ComplaintResponse[] {
    const rows = fetchAll('SELECT * FROM complaint_responses WHERE complaint_id = ? ORDER BY created_at', [complaintId]);
    return rows.map(row => ({
      id: row.id,
      complaintId: row.complaint_id,
      responderId: row.responder_id,
      content: row.content,
      createdAt: row.created_at
    }));
  }

  autoAssign(complaintId: string, storeId: string): void {
    const row = fetchOne(
      'SELECT id FROM users WHERE store_id = ? AND role = "manager" LIMIT 1',
      [storeId]
    );
    if (row) {
      this.assignToManager(complaintId, row.id);
    }
  }
}

export const complaintModel = new ComplaintModel();
