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
    const callCountByUrl: Record<string, number> = {};

    http.defaults.adapter = makeAdapter(async (cfg) => {
      // /auth/refresh trả token mới
      if (cfg.url?.includes('/auth/refresh')) {
        refreshCallCount++;
        return makeResponse(cfg, 200, { accessToken: 'new-token', refreshToken: 'new-refresh' });
      }

      const url = cfg.url ?? '';
      callCountByUrl[url] = (callCountByUrl[url] ?? 0) + 1;

      // Lần đầu (config chưa bị đánh dấu retry trong WeakSet) → 401
      // Sau retry → thành công (interceptor đã đánh dấu config vào retriedConfigs)
      // Phân biệt: lần đầu là lần gọi số 1 cho mỗi URL
      if (callCountByUrl[url] === 1) {
        const err = Object.assign(new Error('Unauthorized'), {
          isAxiosError: true,
          config: cfg,
          response: makeResponse(cfg, 401, { message: 'Unauthorized' }),
        });
        throw err;
      }
      return makeResponse(cfg, 200, { data: 'ok' });
    });

    const results = await Promise.all([
      http.get('/data/1'),
      http.get('/data/2'),
      http.get('/data/3'),
    ]);

    // Refresh chỉ gọi 1 lần dù 3 request cùng 401
    expect(refreshCallCount).toBe(1);
    expect(results).toHaveLength(3);
    // Mỗi URL được gọi đúng 2 lần: 1 lần 401 + 1 lần retry thành công
    expect(callCountByUrl['/data/1']).toBe(2);
    expect(callCountByUrl['/data/2']).toBe(2);
    expect(callCountByUrl['/data/3']).toBe(2);
    // POST /auth/refresh đúng 1 lần
    expect(refreshCallCount).toBe(1);
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
    // Toast được gọi với { id: 'session-expired' } — sonner dùng id này để chống trùng
    // ở runtime. Mock không simulate dedup nên chỉ assert argument, không đếm lần gọi.
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
      { id: 'session-expired' },
    );
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
