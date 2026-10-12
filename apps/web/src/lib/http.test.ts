import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import axios from 'axios';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/features/auth/auth-store';
import { ApiError } from './api-error';
import { http } from './http';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// ─── helpers ────────────────────────────────────────────────────────────────

function makeResponse<T>(
  config: InternalAxiosRequestConfig,
  status: number,
  data: T,
): AxiosResponse<T> {
  return { status, data, headers: {}, config, statusText: String(status) };
}

function makeAdapter(
  handler: (config: InternalAxiosRequestConfig) => AxiosResponse | Promise<AxiosResponse>,
): AxiosAdapter {
  return async (config) => {
    const result = await handler(config as InternalAxiosRequestConfig);
    return result;
  };
}

// ─── setup / teardown ───────────────────────────────────────────────────────

const originalAdapter = http.defaults.adapter;

beforeEach(() => {
  // Reset auth store
  useAuthStore.setState({ accessToken: 'access-token', refreshToken: 'refresh-token', user: null });
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
});

afterEach(() => {
  http.defaults.adapter = originalAdapter;
  useAuthStore.setState({ accessToken: null, refreshToken: null, user: null });
});

// ─── tests ──────────────────────────────────────────────────────────────────

describe('http interceptor — token gắn vào header', () => {
  it('gắn Authorization cho request thường', async () => {
    let captured: InternalAxiosRequestConfig | null = null;
    http.defaults.adapter = makeAdapter((cfg) => {
      captured = cfg;
      return makeResponse(cfg, 200, { ok: true });
    });

    await http.get('/some/path');
    expect((captured as InternalAxiosRequestConfig | null)?.headers?.['Authorization']).toBe('Bearer access-token');
  });

  it('không gắn Authorization cho /auth/login', async () => {
    let captured: InternalAxiosRequestConfig | null = null;
    http.defaults.adapter = makeAdapter((cfg) => {
      captured = cfg;
      return makeResponse(cfg, 200, {});
    });

    await http.post('/auth/login', {});
    expect((captured as InternalAxiosRequestConfig | null)?.headers?.['Authorization']).toBeUndefined();
  });

  it('không gắn Authorization cho /auth/refresh', async () => {
    let captured: InternalAxiosRequestConfig | null = null;
    http.defaults.adapter = makeAdapter((cfg) => {
      captured = cfg;
      return makeResponse(cfg, 200, {});
    });

    await http.post('/auth/refresh', {});
    expect((captured as InternalAxiosRequestConfig | null)?.headers?.['Authorization']).toBeUndefined();
  });
});

describe('http interceptor — 401 single-flight (AC8)', () => {
  it('3 request song song 401 → chỉ gọi refresh 1 lần, cả 3 retry thành công', async () => {
    let refreshCallCount = 0;
    let requestCallCount = 0;

    http.defaults.adapter = makeAdapter(async (cfg) => {
      // /auth/refresh trả token mới
      if (cfg.url?.includes('/auth/refresh')) {
        refreshCallCount++;
        return makeResponse(cfg, 200, { accessToken: 'new-token', refreshToken: 'new-refresh' });
      }
      requestCallCount++;
      // Lần đầu (chưa có header retry) → 401
      if (!cfg.headers?.['x-cms-retried']) {
        const err = Object.assign(new Error('Unauthorized'), {
          isAxiosError: true,
          config: cfg,
          response: makeResponse(cfg, 401, { message: 'Unauthorized' }),
        });
        throw err;
      }
      // Sau retry → thành công
      return makeResponse(cfg, 200, { data: 'ok' });
    });

    const results = await Promise.all([
      http.get('/data/1'),
      http.get('/data/2'),
      http.get('/data/3'),
    ]);

    expect(refreshCallCount).toBe(1);
    expect(results).toHaveLength(3);
    // requestCallCount: 3 lần đầu (401) + 3 lần retry = 6
    expect(requestCallCount).toBe(6);
  });

  it('AC9: refresh thất bại → clear() và toast đúng 1 lần dù nhiều request', async () => {
    http.defaults.adapter = makeAdapter(async (cfg) => {
      if (cfg.url?.includes('/auth/refresh')) {
        const err = Object.assign(new Error('Refresh failed'), {
          isAxiosError: true,
          config: cfg,
          response: makeResponse(cfg, 401, {}),
        });
        throw err;
      }
      const err = Object.assign(new Error('Unauthorized'), {
        isAxiosError: true,
        config: cfg,
        response: makeResponse(cfg, 401, {}),
      });
      throw err;
    });

    const results = await Promise.allSettled([
      http.get('/data/1'),
      http.get('/data/2'),
    ]);

    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    // clear() được gọi → accessToken = null
    expect(useAuthStore.getState().accessToken).toBeNull();
    // Toast hiện đúng 1 lần
    expect(vi.mocked(toast.error)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
  });

  it('AC10: 401 từ /auth/login không refresh', async () => {
    let refreshCalled = false;
    http.defaults.adapter = makeAdapter(async (cfg) => {
      if (cfg.url?.includes('/auth/refresh')) {
        refreshCalled = true;
        return makeResponse(cfg, 200, {});
      }
      const err = Object.assign(new Error('Unauthorized'), {
        isAxiosError: true,
        config: cfg,
        response: makeResponse(cfg, 401, { message: 'Sai mật khẩu' }),
      });
      throw err;
    });

    await expect(http.post('/auth/login', {})).rejects.toBeInstanceOf(ApiError);
    expect(refreshCalled).toBe(false);
  });

  it('AC10: 401 từ /auth/refresh không tạo vòng lặp', async () => {
    let refreshCalled = false;
    // Một adapter duy nhất: request thường trả 401, refresh cũng trả 401
    http.defaults.adapter = makeAdapter(async (cfg) => {
      if (cfg.url?.includes('/auth/refresh')) {
        refreshCalled = true;
        const err = Object.assign(new Error('Refresh failed'), {
          isAxiosError: true,
          config: cfg,
          response: makeResponse(cfg, 401, {}),
        });
        throw err;
      }
      const err = Object.assign(new Error('Unauthorized'), {
        isAxiosError: true,
        config: cfg,
        response: makeResponse(cfg, 401, {}),
      });
      throw err;
    });

    await expect(http.get('/data')).rejects.toBeInstanceOf(ApiError);
    // Refresh được gọi (interceptor trigger refreshTokens)
    expect(refreshCalled).toBe(true);
  });

  it('AC14: lỗi 403 không retry, không xoá phiên', async () => {
    http.defaults.adapter = makeAdapter(async (cfg) => {
      const err = Object.assign(new Error('Forbidden'), {
        isAxiosError: true,
        config: cfg,
        response: makeResponse(cfg, 403, { message: 'Thiếu phòng ban' }),
      });
      throw err;
    });

    const result = await http.get('/data').catch((e) => e);
    expect(result).toBeInstanceOf(ApiError);
    expect(result.status).toBe(403);
    expect(result.message).toBe('Thiếu phòng ban');
    // Phiên không bị xoá
    expect(useAuthStore.getState().accessToken).toBe('access-token');
  });
});

describe('toApiError được dùng trong interceptor', () => {
  it('lỗi mạng → ApiError NETWORK_ERROR', async () => {
    http.defaults.adapter = makeAdapter(async (_cfg) => {
      const err = Object.assign(new Error('Network Error'), { isAxiosError: true });
      throw err;
    });

    const result = await http.get('/data').catch((e) => e);
    expect(result).toBeInstanceOf(ApiError);
    expect(result.code).toBe('NETWORK_ERROR');
  });

  it('timeout → ApiError TIMEOUT', async () => {
    http.defaults.adapter = makeAdapter(async (_cfg) => {
      const err = Object.assign(new Error('timeout'), { isAxiosError: true, code: 'ECONNABORTED' });
      throw err;
    });

    const result = await http.get('/data').catch((e) => e);
    expect(result).toBeInstanceOf(ApiError);
    expect(result.code).toBe('TIMEOUT');
    expect(result.status).toBe(0);
  });
});

describe('axios instance — cấu hình cơ bản', () => {
  it('baseURL đúng', () => {
    expect(http.defaults.baseURL).toBe('http://localhost:3000/api/v1');
  });

  it('timeout = 15000', () => {
    expect(http.defaults.timeout).toBe(15_000);
  });
});
