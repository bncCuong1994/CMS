import type { LoginResponse } from '@cms/shared-types';
import axios, { type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/features/auth/auth-store';
import { toApiError } from './api-error';

export const REQUEST_TIMEOUT_MS = 15_000;

// URL gốc đọc từ EXPO_PUBLIC_API_URL (app.config.ts / .env). KHÔNG hard-code.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export const http = axios.create({
  baseURL: BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
});

// Các path KHÔNG gắn Authorization và KHÔNG tham gia auto-refresh.
// 401 từ /auth/login = sai thông tin; từ /auth/refresh = refresh hỏng;
// từ /auth/logout = token đã thu hồi. Refresh các path này sẽ gây lặp vô hạn.
const AUTH_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout'];

function isAuthPath(url: string | undefined): boolean {
  return AUTH_PATHS.some((p) => url?.startsWith(p));
}

// Single-flight: nhiều request 401 song song chỉ gọi refresh một lần.
let refreshing: Promise<boolean> | null = null;

// Đánh dấu config đã retry để không lặp. Dùng WeakSet để cờ không rời khỏi client.
const retriedConfigs = new WeakSet<InternalAxiosRequestConfig>();

/** Dùng `Pick<LoginResponse,...>` thay vì khai lại kiểu (refresh không trả `user`). */
type RefreshResponse = Pick<LoginResponse, 'accessToken' | 'refreshToken'>;

function refreshTokens(): Promise<boolean> {
  refreshing ??= (async () => {
    const { refreshToken, setTokens, clear } = useAuthStore.getState();
    if (!refreshToken) {
      await clear();
      return false;
    }
    try {
      // Cùng instance http để adapter stub trong test hoạt động.
      const res = await http.post<RefreshResponse>('/auth/refresh', { refreshToken });
      // Refresh token xoay vòng → lưu đè cả accessToken lẫn refreshToken mới.
      await setTokens(res.data);
      return true;
    } catch {
      await clear();
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

// ── Request interceptor ──────────────────────────────────────────────
http.interceptors.request.use((config) => {
  if (!isAuthPath(config.url)) {
    const { accessToken } = useAuthStore.getState();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
  }
  return config;
});

// ── Response error interceptor ───────────────────────────────────────
http.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const axiosLike = error as {
      isAxiosError?: boolean;
      config?: InternalAxiosRequestConfig;
      response?: { status?: number };
    };

    const status = axiosLike.response?.status;
    const config = axiosLike.config;
    const isAuth = isAuthPath(config?.url);
    const alreadyRetried = config ? retriedConfigs.has(config) : false;

    // 401 + không phải auth path + chưa retry → refresh một lần rồi retry.
    if (status === 401 && !isAuth && config && !alreadyRetried) {
      const ok = await refreshTokens();
      if (ok) {
        retriedConfigs.add(config);
        const { accessToken } = useAuthStore.getState();
        config.headers.Authorization = `Bearer ${accessToken}`;
        return http(config);
      }
      // Refresh thất bại: clear() đã gọi trong refreshTokens() → về màn Đăng nhập.
      return Promise.reject(toApiError(error));
    }

    // 403: KHÔNG xoá phiên — chỉ báo lỗi (ApiError giữ message backend).
    return Promise.reject(toApiError(error));
  },
);
