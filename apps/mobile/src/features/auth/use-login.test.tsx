import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { AxiosAdapter } from 'axios';
import { createElement, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { ApiError } from '@/lib/api-error';
import { http } from '@/lib/http';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from './auth-store';
import { useLogin } from './use-login';
import { useLogout } from './use-logout';

type MockSecureStore = typeof SecureStore & { __reset: () => void };

function okAdapter(handler: (url: string, data: unknown) => unknown): AxiosAdapter {
  return async (config) => {
    const data = handler(String(config.url), config.data);
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
}

function errAdapter(status: number, body: unknown): AxiosAdapter {
  return async (config) => {
    const err = new Error('fail') as Error & {
      isAxiosError: boolean;
      config: typeof config;
      response: { status: number; data: unknown; headers: object; statusText: string; config: typeof config };
    };
    err.isAxiosError = true;
    err.config = config;
    err.response = { status, data: body, headers: {}, statusText: 'ERR', config };
    throw err;
  };
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

const MOCK_USER = {
  id: 'u1',
  email: 'a@b.vn',
  fullName: 'Nguyễn Văn A',
  roles: [{ role: 'USER' as const, departmentId: null, departmentName: null }],
  grants: { global: [], departments: {} },
};

function resetAll() {
  (SecureStore as MockSecureStore).__reset();
  jest.clearAllMocks();
  useAuthStore.setState({ accessToken: null, refreshToken: null, user: null, hydrated: true });
}

describe('useLogin / useLogout', () => {
  beforeEach(resetAll);
  // queryClient là module-level (dùng trong useLogout.onSettled); không clear thì
  // cache + notifyManager (setTimeout) giữ handle sống → worker không thoát.
  // react-query gom thông báo observer qua notifyManager rồi flush trên setTimeout(0),
  // nên lần render cuối thoát khỏi phạm vi act() của chính test → cảnh báo act.
  // Bọc một tick trong act() để drain hàng đợi trước khi test kết thúc, rồi clear cache.
  afterEach(async () => {
    await act(async () => {
      await Promise.resolve();
    });
    queryClient.clear();
  });

  it('AC2 — đăng nhập thành công lưu token + user', async () => {
    http.defaults.adapter = okAdapter(() => ({
      accessToken: 'acc', refreshToken: 'ref', user: MOCK_USER,
    }));

    const { result } = renderHook(() => useLogin(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ email: 'a@b.vn', password: 'ok' });
    });

    await waitFor(() => {
      expect(useAuthStore.getState().accessToken).toBe('acc');
    });
    expect(useAuthStore.getState().user?.fullName).toBe('Nguyễn Văn A');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('cms.accessToken', 'acc');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('cms.refreshToken', 'ref');
  });

  it('AC3 — sai mật khẩu: không lưu token, ném message backend', async () => {
    http.defaults.adapter = errAdapter(401, { message: 'Email hoặc mật khẩu không đúng' });

    const { result } = renderHook(() => useLogin(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ email: 'a@b.vn', password: 'wrong' }),
      ).rejects.toMatchObject({ message: 'Email hoặc mật khẩu không đúng' });
    });

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('AC4 — tài khoản khoá (401): hiện message backend, không vào Trang chủ', async () => {
    http.defaults.adapter = errAdapter(401, { message: 'Tài khoản đã bị khoá' });

    const { result } = renderHook(() => useLogin(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ email: 'a@b.vn', password: 'ok' }),
      ).rejects.toMatchObject({ message: 'Tài khoản đã bị khoá', status: 401 });
    });

    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('lỗi ném ra là ApiError (không phải AxiosError thô)', async () => {
    http.defaults.adapter = errAdapter(401, { message: 'x' });
    const { result } = renderHook(() => useLogin(), { wrapper });
    await act(async () => {
      await expect(
        result.current.mutateAsync({ email: 'a@b.vn', password: 'x' }),
      ).rejects.toBeInstanceOf(ApiError);
    });
  });

  it('AC7 — đăng xuất gọi /auth/logout và xoá token', async () => {
    useAuthStore.setState({ accessToken: 'acc', refreshToken: 'ref', user: MOCK_USER });
    let logoutCalled = false;
    http.defaults.adapter = okAdapter((url) => {
      if (url === '/auth/logout') logoutCalled = true;
      return {};
    });

    const { result } = renderHook(() => useLogout(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync();
    });

    await waitFor(() => {
      expect(useAuthStore.getState().accessToken).toBeNull();
    });
    expect(logoutCalled).toBe(true);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('cms.accessToken');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('cms.refreshToken');
  });

  it('AC7 — đăng xuất vẫn xoá token kể cả khi backend lỗi', async () => {
    useAuthStore.setState({ accessToken: 'acc', refreshToken: 'ref', user: MOCK_USER });
    http.defaults.adapter = errAdapter(500, { message: 'server down' });

    const { result } = renderHook(() => useLogout(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync();
    });

    await waitFor(() => {
      expect(useAuthStore.getState().accessToken).toBeNull();
    });
  });
});
