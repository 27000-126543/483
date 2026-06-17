import { create } from 'zustand';
import { User, UserRole } from '../../shared/types.js';

interface AuthState {
  user: User | null;
  token: string | null;
  login: (phone: string, password: string, role: UserRole) => Promise<void>;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

const API_BASE = 'http://localhost:3001/api';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,

  login: async (phone: string, password: string, role: UserRole) => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password, role })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '登录失败');
    }

    const data = await response.json();
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    set({ token: data.token, user: data.user });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null });
  },

  updateUser: (userData: Partial<User>) => {
    const currentUser = get().user;
    if (currentUser) {
      const updatedUser = { ...currentUser, ...userData };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      set({ user: updatedUser });
    }
  }
}));

export function initializeAuth() {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  if (token && userStr) {
    try {
      const user = JSON.parse(userStr);
      useAuthStore.setState({ token, user });
    } catch (e) {
      console.error('Failed to parse user from localStorage');
    }
  }
}
