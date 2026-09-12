// src/services/monitoringService.ts — Super-Admin system monitoring
import { authService } from './authService';

export interface UserRoleStat {
  role: string;
  count: number;
  active: number;
}

export interface RecentActivityItem {
  type: string;
  id: number;
  reference: string;
  created_at: string;
}

export interface MonitoringStats {
  totalPatients: number;
  totalAppointments: number;
  appointmentsToday: number;
  totalTransactions: number;
  totalRevenue: number;
  totalFrames: number;
  totalProducts: number;
  lowStockProducts: number;
  usersByRole: UserRoleStat[];
  recentActivity: RecentActivityItem[];
}

const API_BASE = 'http://127.0.0.1:5000/api';

export const monitoringService = {
  getStats: async (): Promise<MonitoringStats> => {
    const response = await fetch(`${API_BASE}/monitoring/stats`, {
      headers: { ...authService.authHeader() },
    });
    if (!response.ok) throw new Error('Failed to fetch system monitoring stats');
    return response.json();
  },
};
