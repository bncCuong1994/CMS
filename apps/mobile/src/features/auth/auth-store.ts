import type { LoginResponse, MeResponse } from '@cms/shared-types';
import { create } from 'zustand';
import { clearTokens, loadTokens, saveTokens, type StoredTokens } from '@/lib/secure-store';

/**
 * Trạng thái phiên đăng nhập.
 * - Token được giữ trong bộ nhớ để interceptor đọc đồng bộ, nhưng NGUỒN THẬT là
 *   expo-secure-store. Mọi thay đổi token đều ghi xuống secure-store.
 * - `hydrated` đánh dấu đã nạp xong phiên từ secure-store khi mở app (để auth gate
 *   không nhấp nháy về màn Đăng nhập trước khi biết có token hay không).
 * - KHÔNG log token.
 */
interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: MeResponse | null;
  hydrated: boolean;

  /** Nạp phiên từ secure-store khi mở app. */
  hydrate: () => Promise<void>;
  /** Đăng nhập thành công: lưu cả token (secure-store) lẫn user. */
  setSession: (session: LoginResponse) => Promise<void>;
  /** Cập nhật cặp token mới (refresh xoay vòng) — ghi đè secure-store. */
  setTokens: (tokens: StoredTokens) => Promise<void>;
  /** Làm tươi thông tin user (từ /auth/me). */
  setUser: (user: MeResponse) => void;
  /** Xoá sạch phiên + token khỏi secure-store. */
  clear: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  hydrated: false,

  hydrate: async () => {
    const tokens = await loadTokens();
    set({
      accessToken: tokens?.accessToken ?? null,
      refreshToken: tokens?.refreshToken ?? null,
      hydrated: true,
    });
  },

  setSession: async ({ accessToken, refreshToken, user }) => {
    await saveTokens({ accessToken, refreshToken });
    set({ accessToken, refreshToken, user });
  },

  setTokens: async (tokens) => {
    await saveTokens(tokens);
    set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  },

  setUser: (user) => set({ user }),

  clear: async () => {
    await clearTokens();
    set({ accessToken: null, refreshToken: null, user: null });
  },
}));
