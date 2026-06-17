import { BaseModel } from './BaseModel.js';
import { Pet } from '../../../shared/types.js';
import { executeQuery, fetchAll } from '../database.js';

export class PetModel extends BaseModel<Pet> {
  protected tableName = 'pets';

  protected fromRow(row: any): Pet {
    return {
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      species: row.species,
      breed: row.breed,
      age: row.age,
      weight: row.weight,
      gender: row.gender,
      createdAt: row.created_at
    };
  }

  create(data: Omit<Pet, 'id' | 'createdAt'>): Pet {
    const id = this.generateId();
    executeQuery(
      'INSERT INTO pets (id, owner_id, name, species, breed, age, weight, gender) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, data.ownerId, data.name, data.species, data.breed || null, data.age || null, data.weight || null, data.gender || null]
    );
    return this.findById(id)!;
  }

  findByOwnerId(ownerId: string): Pet[] {
    return this.findAll('owner_id = ?', [ownerId]);
  }

  update(id: string, data: Partial<Pet>): Pet {
    const fields: string[] = [];
    const params: any[] = [];

    if (data.name) {
      fields.push('name = ?');
      params.push(data.name);
    }
    if (data.species) {
      fields.push('species = ?');
      params.push(data.species);
    }
    if (data.breed !== undefined) {
      fields.push('breed = ?');
      params.push(data.breed);
    }
    if (data.age !== undefined) {
      fields.push('age = ?');
      params.push(data.age);
    }
    if (data.weight !== undefined) {
      fields.push('weight = ?');
      params.push(data.weight);
    }
    if (data.gender !== undefined) {
      fields.push('gender = ?');
      params.push(data.gender);
    }

    params.push(id);
    executeQuery(`UPDATE pets SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.findById(id)!;
  }
}

export const petModel = new PetModel();
