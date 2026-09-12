// src/services/patientService.ts

// Interface exactly matching your MariaDB table structure
export interface Patient {
  patient_id: string;
  name: string;
  age: number;
  gender: string;
  contact: string;
  last_visit: string;
  status: 'Active' | 'Pending' | 'Completed';
}

const API_BASE_URL = 'http://localhost:5000/api';

export const patientService = {
  // READ ALL
  getAll: async (): Promise<Patient[]> => {
    const response = await fetch(`${API_BASE_URL}/patients`);
    if (!response.ok) throw new Error('Network response was not ok');
    return response.json();
  },

  // READ ONE — powers the Patient Profile detail view
  getById: async (id: string): Promise<Patient> => {
    const response = await fetch(`${API_BASE_URL}/patients/${id}`);
    if (!response.ok) throw new Error('Patient not found');
    return response.json();
  },

  // CREATE
  create: async (patient: Patient): Promise<Patient> => {
    const response = await fetch(`${API_BASE_URL}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patient),
    });
    if (!response.ok) throw new Error('Failed to commit profile instance');
    return response.json();
  },

  // UPDATE
  update: async (id: string, updates: Partial<Patient>): Promise<Patient> => {
    const response = await fetch(`${API_BASE_URL}/patients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update profile context');
    return response.json();
  },

  // DELETE
  delete: async (id: string): Promise<boolean> => {
    const response = await fetch(`${API_BASE_URL}/patients/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to process record deletion');
    const data = await response.json();
    return data.success;
  }
};