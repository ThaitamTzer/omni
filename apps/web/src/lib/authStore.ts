import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Staff {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'AGENT';
}

interface AuthState {
  staff: Staff | null;
  accessToken: string | null;
  setAuth: (data: { token: string; staff: Staff }) => void;
  setTokens: (accessToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      staff: null,
      accessToken: null,

      setAuth: ({ token, staff }) =>
        set({ accessToken: token, staff }),

      setTokens: (accessToken) =>
        set({ accessToken }),

      logout: () => set({ staff: null, accessToken: null }),
    }),
    { name: 'omni-auth' },
  ),
);

// Convenience selectors
export const useStaff = () => useAuthStore((s) => s.staff);
export const useAccessToken = () => useAuthStore((s) => s.accessToken);
