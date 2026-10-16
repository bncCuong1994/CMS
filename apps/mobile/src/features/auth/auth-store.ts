import type { LoginResponse, MeResponse } from '@cms/shared-types';
import { create } from 'zustand';
import {
  clearTokens,
  disableBiometricLogin,
  enableBiometricLogin,
  isBiometricLoginEnabled,
  loadTokens,
  saveTokens,
  type StoredTokens,
} from '@/lib/secure-store';

/**
 * Trạng thái phiên đăng nhập.
 * - Token được giữ trong bộ nhớ để interceptor đọc đồng bộ, nhưng NGUỒN THẬT là
 *   expo-secure-store. Mọi thay đổi token đều ghi xuống secure-store.
 * - `hydrated` đánh dấu đã nạp xong phiên từ secure-store khi mở app (để auth gate
 *   không nhấp nháy về màn Đăng nhập trước khi biết có token hay không).
 * - `biometricEnabled` là cờ Face ID đăng nhập (US-ATT-08) — quyết định ẩn/hiện nút
 *   Face ID (AC1/AC9). Đây CHỈ là cờ; refresh token gated nằm ở khe secure-store riêng.
 * - KHÔNG log token.
 */
interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: MeResponse | null;
  hydrated: boolean;
  biometricEnabled: boolean;

  /** Nạp phiên + cờ Face ID từ secure-store khi mở app. */
  hydrate: () => Promise<void>;
  /** Đăng nhập thành công: lưu cả token (secure-store) lẫn user. */
  setSession: (session: LoginResponse) => Promise<void>;
  /** Cập nhật cặp token mới (refresh xoay vòng) — ghi đè secure-store. */
  setTokens: (tokens: StoredTokens) => Promise<void>;
  /** Làm tươi thông tin user (từ /auth/me). */
  setUser: (user: MeResponse) => void;
  /** Bật Face ID: lưu refresh token hiện tại vào khe gated + cờ (AC3). */
  enableBiometric: () => Promise<boolean>;
  /** Tắt Face ID: xoá khe gated + cờ (AC8). Phiên hiện tại giữ nguyên. */
  disableBiometric: () => Promise<void>;
  /** Xoá sạch phiên + token + khe Face ID gated khỏi secure-store. */
  clear: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  hydrated: false,
  biometricEnabled: false,

  hydrate: async () => {
    const [tokens, biometricEnabled] = await Promise.all([
      loadTokens(),
      isBiometricLoginEnabled(),
    ]);
    set({
      accessToken: tokens?.accessToken ?? null,
      refreshToken: tokens?.refreshToken ?? null,
      biometricEnabled,
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

  enableBiometric: async () => {
    const { refreshToken } = get();
    if (!refreshToken) return false;
    await enableBiometricLogin(refreshToken);
    set({ biometricEnabled: true });
    return true;
  },

  disableBiometric: async () => {
    await disableBiometricLogin();
    set({ biometricEnabled: false });
  },

  clear: async () => {
    await Promise.all([clearTokens(), disableBiometricLogin()]);
    set({ accessToken: null, refreshToken: null, user: null, biometricEnabled: false });
  },
}));
