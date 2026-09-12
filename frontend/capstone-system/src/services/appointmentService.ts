// src/services/appointmentService.ts

export interface Appointment {
  id?: number;
  appointment_id?: number;
  patient_id: number | string;
  patient_name?: string; //
  appointment_date: string;
  appointment_time: string;
  purpose_of_visit: string;
  appointment_status: string;
}

export interface CreateAppointmentResponse {
  message: string;
  appointmentId: number;
}

const API_BASE = 'http://127.0.0.1:5000/api';

export const appointmentService = {
  // Fetch all active appointments (returns patient_name via LEFT JOIN)
  getAll: async (): Promise<Appointment[]> => {
    const response = await fetch(`${API_BASE}/appointments`);
    if (!response.ok) throw new Error('Failed to fetch appointments');
    return response.json();
  },

  // Create a new appointment
  create: async (appointment: Omit<Appointment, 'appointment_id' | 'patient_name'>): Promise<CreateAppointmentResponse> => {
    const response = await fetch(`${API_BASE}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appointment),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to create appointment');
    }
    return response.json();
  },

  // Full update (PUT /api/appointments/:id)
  update: async (id: number | string, data: Partial<Appointment>): Promise<Appointment> => {
    const response = await fetch(`${API_BASE}/appointments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to update appointment on server.');
    }
    return response.json();
  },

  // Status-only quick update (PATCH /api/appointments/:id)
  updateStatus: async (id: number | string, status: string): Promise<{ appointment_id: number; appointment_status: string }> => {
    const response = await fetch(`${API_BASE}/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointment_status: status }),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to update appointment status.');
    }
    return response.json();
  },
};