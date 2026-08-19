import { useEffect } from 'react';
import {
  atom,
  useRecoilCallback,
  useRecoilValue,
  useSetRecoilState,
} from 'recoil';

export interface Staff {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'AGENT';
}

interface AuthState {
  staff: Staff | null;
  accessToken: string | null;
}

const STORAGE_KEY = 'omni-auth';

function loadAuth(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { staff: null, accessToken: null };
    const parsed = JSON.parse(raw) as {
      state?: Partial<AuthState>;
    } & Partial<AuthState>;
    // Hỗ trợ format cũ của zustand persist: { state: { staff, accessToken }, version }
    const src = parsed.state ?? parsed;
    return {
      staff: src.staff ?? null,
      accessToken: typeof src.accessToken === 'string' ? src.accessToken : null,
    };
  } catch {
    return { staff: null, accessToken: null };
  }
}

/** Nguồn đọc cho code ngoài React (api.ts). Effect của atom cập nhật biến này mỗi khi state đổi. */
let currentAuth: AuthState = loadAuth();

const authAtom = atom<AuthState>({
  key: 'authState',
  default: currentAuth,
  effects: [
    ({ onSet }) => {
      onSet((next) => {
        currentAuth = next;
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // storage unavailable (private mode / quota) — keep in-memory state
        }
      });
    },
  ],
});

type AuthUpdater = AuthState | ((prev: AuthState) => AuthState);

let externalSet: ((updater: AuthUpdater) => void) | null = null;

/**
 * Đặt trong RecoilRoot: mở cổng set state cho code ngoài React
 * (Recoil không có getState() kiểu zustand nên cần bridge này).
 */
export function AuthBridge() {
  const setAuth = useRecoilCallback(
    ({ set }) => (updater: AuthUpdater) => set(authAtom, updater),
    [],
  );
  useEffect(() => {
    externalSet = setAuth;
    return () => {
      externalSet = null;
    };
  }, [setAuth]);
  return null;
}

// ---- React hooks ----
/** staff hiện tại */
export const useStaff = () => useRecoilValue(authAtom).staff;

/** setter auth — login response { token, staff } */
export const useSetAuth = () => useSetRecoilState(authAtom);

/** logout */
export const useLogout = () => {
  const setAuth = useSetRecoilState(authAtom);
  return () => setAuth({ staff: null, accessToken: null });
};

// ---- Non-React API (api.ts) ----
/** Đọc accessToken ngoài React (socket auth, request header) */
export function getStoredAccessToken(): string | null {
  return currentAuth.accessToken;
}

function commit(updater: AuthUpdater): void {
  const next =
    typeof updater === 'function'
      ? (updater as (prev: AuthState) => AuthState)(currentAuth)
      : updater;
  // Cập nhật mirror + storage trước để đúng cả khi bridge chưa mount
  currentAuth = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore — keep in-memory state
  }
  externalSet?.(next);
}

/** Gán auth từ login response */
export function setStoredAuth(data: { token: string; staff: Staff }): void {
  commit({ staff: data.staff, accessToken: data.token });
}

/** Gán token mới sau refresh */
export function setStoredToken(accessToken: string): void {
  commit((prev) => ({ ...prev, accessToken }));
}

/** Xóa auth khi logout / session expired */
export function clearStoredAuth(): void {
  commit({ staff: null, accessToken: null });
}
