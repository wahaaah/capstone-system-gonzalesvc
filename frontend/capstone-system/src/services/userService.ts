// src/services/userService.ts — Super-Admin account maintenance
import { authService } from './authService';

export interface ManagedUser {
  user_id: number;
  username: string;
  full_name: string | null;
  role: 'super_admin' | 'admin' | 'staff';
  is_active: number | boolean;
  created_at: string;
}

const API_BASE = 'http://127.0.0.1:5000/api';

export const userService = {
  getAll: async (): Promise<ManagedUser[]> => {
    const response = await fetch(`${API_BASE}/auth/users`, {
      headers: { ...authService.authHeader() },
    });
    if (!response.ok) throw new Error('Failed to fetch accounts');
    return response.json();
  },

  create: async (user: {
    username: string;
    password: string;
    full_name?: string;
    role: 'admin' | 'staff';
  }): Promise<ManagedUser> => {
    const response = await fetch(`${API_BASE}/auth/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authService.authHeader() },
      body: JSON.stringify(user),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to create account' }));
      throw new Error(err.error);
    }
    return response.json();
  },

  setActive: async (userId: number, isActive: boolean): Promise<void> => {
    const response = await fetch(`${API_BASE}/auth/users/${userId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authService.authHeader() },
      body: JSON.stringify({ is_active: isActive }),
    });
    if (!response.ok) throw new Error('Failed to update account status');
  },
};
