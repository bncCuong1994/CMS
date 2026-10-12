import axios, { type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import { useAuthStore } from '@/features/auth/auth-store';
import { toApiError } from './api-error';

export const REQUEST_TIMEOUT_MS = 15_000;

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export const http = axios.create({
  baseURL: BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
});

// Các path không gắn Authorization, không refresh
const AUTH_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout'];

function isAuthPath(url: string | undefined): boolean {
  return AUTH_PATHS.some((p) => url?.startsWith(p));
}

// Single-flight: nhiều request 401 song song chỉ gọi refresh một lần
let refreshing: Promise<boolean> | null = null;

// Theo dõi config đã được retry để tránh vòng lặp vô tận.
// Dùng WeakSet thay cho header để cờ không rời khỏi client.
const retriedConfigs = new WeakSet<InternalAxiosRequestConfig>();

function refreshTokens(): Promise<boolean> {
  refreshing ??= (async () => {
    const { refreshToken, setTokens, clear } = useAuthStore.getState();
    if (!refreshToken) {
      clear();
      return false;
    }
    try {
      // Dùng http (cùng instance) để adapter stub trong test hoạt động được
      const res = await http.post<{ accessToken: string; refreshToken: string }>(
        '/auth/refresh',
        { refreshToken },
      );
      setTokens(res.data);
      return true;
    } catch {
      clear();
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

    // 401 + không phải auth path + chưa retry → thử refresh
    if (status === 401 && !isAuth && config && !alreadyRetried) {
      const ok = await refreshTokens();
      if (ok) {
        retriedConfigs.add(config);
        const { accessToken } = useAuthStore.getState();
        config.headers.Authorization = `Bearer ${accessToken}`;
        return http(config);
      }
      // Refresh thất bại: clear() đã gọi trong refreshTokens().
      // Ngoại lệ có chủ ý: toast phiên hết hạn nằm trong interceptor thay vì handleQueryError,
      // vì 401 trên query chưa có data sẽ bị handleQueryError bỏ qua (chỉ toast khi refetch nền).
      // sonner chống trùng theo { id } nên AC9 được bảo đảm bởi thư viện, không bằng timing.
      toast.error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại', { id: 'session-expired' });
      return Promise.reject(toApiError(error));
    }

    return Promise.reject(toApiError(error));
  },
);
