import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => {
        localStorage.setItem('token', token);
        set({ user, token, isAuthenticated: true });
      },
      clearAuth: () => {
        localStorage.removeItem('token');
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'ui-storage',
    }
  )
);

interface NotificationState {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
  decrementUnread: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  setUnreadCount: (count) => set({ unreadCount: count }),
  incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
  decrementUnread: () => set((state) => ({ unreadCount: Math.max(0, state.unreadCount - 1) })),
}));

interface ScanState {
  activeScans: Map<string, { progress: number; status: string; currentStep?: string }>;
  updateScan: (scanId: string, data: { progress?: number; status?: string; currentStep?: string }) => void;
  removeScan: (scanId: string) => void;
}

export const useScanStore = create<ScanState>((set) => ({
  activeScans: new Map(),
  updateScan: (scanId, data) =>
    set((state) => {
      const newScans = new Map(state.activeScans);
      const existing = newScans.get(scanId) || { progress: 0, status: 'queued' };
      newScans.set(scanId, { ...existing, ...data });
      return { activeScans: newScans };
    }),
  removeScan: (scanId) =>
    set((state) => {
      const newScans = new Map(state.activeScans);
      newScans.delete(scanId);
      return { activeScans: newScans };
    }),
}));

