import { BaseModel } from './BaseModel.js';
import { Department, DoctorSpecialty } from '../../../shared/types.js';
import { executeQuery, fetchAll, fetchOne } from '../database.js';

export class DepartmentModel extends BaseModel<Department> {
  protected tableName = 'departments';

  protected fromRow(row: any): Department {
    return {
      id: row.id,
      name: row.name,
      keywords: row.keywords,
      description: row.description,
      createdAt: row.created_at
    };
  }

  create(data: Omit<Department, 'id' | 'createdAt'>): Department {
    const id = this.generateId();
    executeQuery(
      'INSERT INTO departments (id, name, keywords, description) VALUES (?, ?, ?, ?)',
      [id, data.name, data.keywords, data.description || null]
    );
    return this.findById(id)!;
  }

  matchBySymptoms(symptoms: string): Department | null {
    const departments = this.findAll();
    const symptomsLower = symptoms.toLowerCase();

    let bestMatch: Department | null = null;
    let maxMatches = 0;

    for (const dept of departments) {
      const keywords = dept.keywords.toLowerCase().split(',');
      const matches = keywords.filter(keyword => symptomsLower.includes(keyword.trim())).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        bestMatch = dept;
      }
    }

    return bestMatch || departments[0] || null;
  }

  getDoctorSpecialties(departmentId: string): DoctorSpecialty[] {
    const rows = fetchAll('SELECT * FROM doctor_specialties WHERE department_id = ?', [departmentId]);
    return rows.map(row => ({
      id: row.id,
      doctorId: row.doctor_id,
      departmentId: row.department_id,
      keywords: row.keywords,
      rating: row.rating
    }));
  }

  addDoctorSpecialty(data: Omit<DoctorSpecialty, 'id'>): DoctorSpecialty {
    const id = this.generateId();
    executeQuery(
      'INSERT INTO doctor_specialties (id, doctor_id, department_id, keywords, rating) VALUES (?, ?, ?, ?, ?)',
      [id, data.doctorId, data.departmentId, data.keywords || null, data.rating]
    );
    const row = fetchOne('SELECT * FROM doctor_specialties WHERE id = ?', [id]);
    return {
      id: row.id,
      doctorId: row.doctor_id,
      departmentId: row.department_id,
      keywords: row.keywords,
      rating: row.rating
    };
  }
}

export const departmentModel = new DepartmentModel();
