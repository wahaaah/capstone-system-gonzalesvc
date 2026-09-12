// src/services/authService.ts

export interface AuthUser {
  user_id: number;
  username: string;
  full_name: string | null;
  role: 'super_admin' | 'admin' | 'staff';
}

const API_BASE = 'http://127.0.0.1:5000/api';
const TOKEN_KEY = 'gvc_auth_token';
const USER_KEY = 'gvc_auth_user';

export const authService = {
  login: async (username: string, password: string): Promise<AuthUser> => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(err.error || 'Login failed');
    }
    const data = await response.json();
    sessionStorage.setItem(TOKEN_KEY, data.token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data.user;
  },

  logout: () => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  },

  getToken: (): string | null => sessionStorage.getItem(TOKEN_KEY),

  getCurrentUser: (): AuthUser | null => {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },

  authHeader: (): Record<string, string> => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
};
