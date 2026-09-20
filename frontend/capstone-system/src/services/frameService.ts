// src/services/frameService.ts
import { authService } from './authService';

export interface Frame {
  frame_id: number;
  name: string;
  brand: string | null;
  material: string | null;
  category: string | null;
  description: string | null;
  price: number;
  stock_quantity: number;
  image_url?: string | null;
  image_2d_url: string | null;
  model_3d_url: string | null;
  conversion_status: 'Not Converted' | 'Processing' | 'Converted' | 'Failed';
  created_at?: string;
}

const API_BASE = 'https://gonzalesvisionclinic.onrender.com/api';

export const frameService = {
  getAll: async (): Promise<Frame[]> => {
    const response = await fetch(`${API_BASE}/frames`);
    if (!response.ok) throw new Error('Failed to fetch frames');
    return response.json();
  },

  getById: async (id: number): Promise<Frame> => {
    const response = await fetch(`${API_BASE}/frames/${id}`);
    if (!response.ok) throw new Error('Frame not found');
    return response.json();
  },

  create: async (frame: Partial<Frame>): Promise<Frame> => {
    const response = await fetch(`${API_BASE}/frames`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authService.authHeader() },
      body: JSON.stringify(frame),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to create frame' }));
      throw new Error(err.error || 'Failed to create frame');
    }
    return response.json();
  },

  update: async (id: number, frame: Partial<Frame>): Promise<Frame> => {
    const response = await fetch(`${API_BASE}/frames/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authService.authHeader() },
      body: JSON.stringify(frame),
    });
    if (!response.ok) throw new Error('Failed to update frame');
    return response.json();
  },

  remove: async (id: number): Promise<void> => {
    const response = await fetch(`${API_BASE}/frames/${id}`, {
      method: 'DELETE',
      headers: { ...authService.authHeader() },
    });
    if (!response.ok) throw new Error('Failed to delete frame');
  },

  convert: async (id: number, model3dUrl: string): Promise<Frame> => {
    const response = await fetch(`${API_BASE}/frames/${id}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authService.authHeader() },
      body: JSON.stringify({ model_3d_url: model3dUrl }),
    });
    if (!response.ok) throw new Error('Conversion failed');
    return response.json();
  },
};