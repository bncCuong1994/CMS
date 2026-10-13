import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/features/auth/auth-store';
import { ApiError } from './api-error';
import { http } from './http';

type MockSecureStore = typeof SecureStore & { __reset: () => void };

// Tạo response/lỗi axios giả để adapter trả về mà không chạm mạng.
function ok(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return { data, status: 200, statusText: 'OK', headers: {}, config };
}

function axiosError(config: InternalAxiosRequestConfig, status: number, body: unknown) {
  const err = new Error(`Request failed with status ${status}`) as Error & {
    isAxiosError: boolean;
    config: InternalAxiosRequestConfig;
    response: { status: number; data: unknown; headers: object; statusText: string; config: InternalAxiosRequestConfig };
  };
  err.isAxiosError = true;
  err.config = config;
  err.response = { status, data: body, headers: {}, statusText: 'ERR', config };
  return err;
}

function setAdapter(adapter: AxiosAdapter) {
  http.defaults.adapter = adapter;
}

function resetAll() {
  (SecureStore as MockSecureStore).__reset();
  jest.clearAllMocks();
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    user: null,
    hydrated: true,
  });
}

describe('http interceptor (US-WEB-01 trên mobile)', () => {
  beforeEach(resetAll);

  it('gắn Bearer cho request thường, KHÔNG gắn cho /auth/* (AC8-ish)', async () => {
    useAuthStore.setState({ accessToken: 'acc', refreshToken: 'ref' });
    const seen: Record<string, unknown> = {};

    setAdapter(async (config) => {
      seen[String(config.url)] = config.headers?.Authorization;
      return ok(config, {});
    });

    await http.get('/tasks');
    await http.post('/auth/login', { email: 'a', password: 'b' });

    expect(seen['/tasks']).toBe('Bearer acc');
    expect(seen['/auth/login']).toBeUndefined();
  });

  it('401 trên API thường → refresh MỘT lần rồi retry thành công (AC6)', async () => {
    useAuthStore.setState({ accessToken: 'old-acc', refreshToken: 'old-ref' });
    let tasksCalls = 0;
    let refreshCalls = 0;

    setAdapter(async (config) => {
      const url = String(config.url);
      if (url === '/auth/refresh') {
        refreshCalls += 1;
        return ok(config, { accessToken: 'new-acc', refreshToken: 'new-ref' });
      }
      if (url === '/tasks') {
        tasksCalls += 1;
        if (tasksCalls === 1) throw axiosError(config, 401, { message: 'expired' });
        return ok(config, { ok: true });
      }
      return ok(config, {});
    });

    const res = await http.get('/tasks');

    expect(res.data).toEqual({ ok: true });
    expect(refreshCalls).toBe(1); // chỉ refresh một lần
    expect(tasksCalls).toBe(2); // gọi lại sau refresh
    // Token mới (xoay vòng) đã lưu đè.
    expect(useAuthStore.getState().accessToken).toBe('new-acc');
    expect(useAuthStore.getState().refreshToken).toBe('new-ref');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('cms.accessToken', 'new-acc');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('cms.refreshToken', 'new-ref');
  });

  it('nhiều request 401 song song → refresh single-flight, chỉ gọi MỘT lần (AC6)', async () => {
    useAuthStore.setState({ accessToken: 'old-acc', refreshToken: 'old-ref' });
    let refreshCalls = 0;
    const firstHit: Record<string, boolean> = {};

    setAdapter(async (config) => {
      const url = String(config.url);
      if (url === '/auth/refresh') {
        refreshCalls += 1;
        return ok(config, { accessToken: 'new-acc', refreshToken: 'new-ref' });
      }
      // Mỗi path trả 401 ở lần đầu, thành công ở lần retry sau refresh.
      if (!firstHit[url]) {
        firstHit[url] = true;
        throw axiosError(config, 401, { message: 'expired' });
      }
      return ok(config, { url });
    });

    // Hai request song song cùng nhận 401 trước khi refresh xong.
    const [a, b] = await Promise.all([http.get('/a'), http.get('/b')]);

    // Dù hai request 401 song song, refresh chỉ chạy đúng MỘT lần (refreshing ??=).
    expect(refreshCalls).toBe(1);
    // Cả hai request được retry và thành công.
    expect(a.data).toEqual({ url: '/a' });
    expect(b.data).toEqual({ url: '/b' });
    // Token xoay vòng đã lưu đè.
    expect(useAuthStore.getState().accessToken).toBe('new-acc');
    expect(useAuthStore.getState().refreshToken).toBe('new-ref');
  });

  it('401 + refresh thất bại → clear token (về Đăng nhập) và ném ApiError (AC6)', async () => {
    useAuthStore.setState({ accessToken: 'old-acc', refreshToken: 'bad-ref' });

    setAdapter(async (config) => {
      const url = String(config.url);
      if (url === '/auth/refresh') throw axiosError(config, 401, { message: 'revoked' });
      if (url === '/tasks') throw axiosError(config, 401, { message: 'expired' });
      return ok(config, {});
    });

    await expect(http.get('/tasks')).rejects.toBeInstanceOf(ApiError);

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('cms.accessToken');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('cms.refreshToken');
  });

  it('403 → KHÔNG xoá phiên, chỉ ném ApiError với message backend', async () => {
    useAuthStore.setState({ accessToken: 'acc', refreshToken: 'ref' });

    setAdapter(async (config) => {
      throw axiosError(config, 403, { message: 'Bạn không có quyền' });
    });

    await expect(http.get('/reports')).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
      message: 'Bạn không có quyền',
    });

    // Phiên vẫn còn nguyên.
    expect(useAuthStore.getState().accessToken).toBe('acc');
    expect(useAuthStore.getState().refreshToken).toBe('ref');
  });

  it('401 từ chính /auth/login KHÔNG kích hoạt refresh (tránh lặp)', async () => {
    useAuthStore.setState({ accessToken: null, refreshToken: null });
    let refreshCalls = 0;

    setAdapter(async (config) => {
      const url = String(config.url);
      if (url === '/auth/refresh') {
        refreshCalls += 1;
        return ok(config, { accessToken: 'x', refreshToken: 'y' });
      }
      if (url === '/auth/login') {
        throw axiosError(config, 401, { message: 'Email hoặc mật khẩu không đúng' });
      }
      return ok(config, {});
    });

    await expect(http.post('/auth/login', {})).rejects.toMatchObject({
      status: 401,
      message: 'Email hoặc mật khẩu không đúng',
    });
    expect(refreshCalls).toBe(0);
  });
});
