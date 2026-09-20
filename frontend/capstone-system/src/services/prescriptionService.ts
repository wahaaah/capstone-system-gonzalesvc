// src/services/prescriptionService.ts

export interface Prescription {
  prescription_id: number;
  patient_id: string;
  od_sph: string | null;
  od_cyl: string | null;
  os_sph: string | null;
  os_cyl: string | null;
  notes: string | null;
}

const API_BASE = 'https://gonzalesvisionclinic.onrender.com/api';

export const prescriptionService = {
  getForPatient: async (patientId: string): Promise<Prescription[]> => {
    const response = await fetch(`${API_BASE}/prescriptions?patient_id=${encodeURIComponent(patientId)}`);
    if (!response.ok) throw new Error('Failed to fetch prescriptions');
    return response.json();
  },

  create: async (prescription: Omit<Prescription, 'prescription_id'>): Promise<Prescription> => {
    const response = await fetch(`${API_BASE}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prescription),
    });
    if (!response.ok) throw new Error('Failed to save prescription');
    return response.json();
  },

  update: async (prescriptionId: number, prescription: Partial<Prescription>): Promise<Prescription> => {
    const response = await fetch(`${API_BASE}/prescriptions/${prescriptionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prescription),
    });
    if (!response.ok) throw new Error('Failed to update prescription');
    return response.json();
  },
};