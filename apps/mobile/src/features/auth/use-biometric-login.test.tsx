import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { AxiosAdapter } from 'axios';
import { createElement, type ReactNode } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { http } from '@/lib/http';
import { useAuthStore } from './auth-store';
import { useBiometricLogin } from './use-biometric-login';

type MockSecureStore = typeof SecureStore & { __reset: () => void };
type MockBio = typeof LocalAuthentication & {
  __setBiometric: (patch: Record<string, unknown>) => void;
  __resetBiometric: () => void;
};

const GATED_KEY = 'cms.biometricRefreshToken';
const ENABLED_KEY = 'cms.biometricLoginEnabled';

function okRefresh(): AxiosAdapter {
  return async (config) => ({
    data: { accessToken: 'acc-new', refreshToken: 'ref-new' },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  });
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
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return createElement(QueryClientProvider, { client }, children);
}

function resetAll() {
  (SecureStore as MockSecureStore).__reset();
  (LocalAuthentication as MockBio).__resetBiometric();
  jest.clearAllMocks();
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    user: null,
    hydrated: true,
    biometricEnabled: false,
  });
}

/** Giả lập trạng thái đã bật Face ID: có khe gated + cờ. */
async function seedEnabled() {
  await SecureStore.setItemAsync(GATED_KEY, 'ref-gated');
  await SecureStore.setItemAsync(ENABLED_KEY, '1');
  useAuthStore.setState({ biometricEnabled: true });
}

describe('useBiometricLogin (AC4/AC5/AC6)', () => {
  beforeEach(resetAll);

  it('AC4 — Face ID thành công: refresh → lưu đè token mới → success', async () => {
    await seedEnabled();
    http.defaults.adapter = okRefresh();

    const { result } = renderHook(() => useBiometricLogin(), { wrapper });
    let outcome;
    await act(async () => {
      outcome = await result.current.mutateAsync('Đăng nhập bằng Face ID');
    });

    expect(outcome).toEqual({ kind: 'success' });
    await waitFor(() => {
      expect(useAuthStore.getState().accessToken).toBe('acc-new');
    });
    expect(useAuthStore.getState().refreshToken).toBe('ref-new');
    // Token xoay vòng: khe gated được ghi đè bằng refresh token mới.
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(GATED_KEY, 'ref-new', {
      requireAuthentication: true,
    });
    expect(useAuthStore.getState().biometricEnabled).toBe(true);
  });

  it('AC5 — sinh trắc huỷ/thất bại: cancelled, không refresh, giữ cờ', async () => {
    await seedEnabled();
    (LocalAuthentication as MockBio).__setBiometric({ authSuccess: false });
    const refreshSpy = jest.fn();
    http.defaults.adapter = async (config) => {
      refreshSpy();
      return okRefresh()(config);
    };

    const { result } = renderHook(() => useBiometricLogin(), { wrapper });
    let outcome;
    await act(async () => {
      outcome = await result.current.mutateAsync('Đăng nhập bằng Face ID');
    });

    expect(outcome).toEqual({ kind: 'cancelled' });
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(useAuthStore.getState().biometricEnabled).toBe(true); // cờ KHÔNG bị xoá
  });

  it('AC6 — refresh trả 401: xoá khe gated + cờ, báo expired', async () => {
    await seedEnabled();
    http.defaults.adapter = errAdapter(401, { message: 'token revoked' });

    const { result } = renderHook(() => useBiometricLogin(), { wrapper });
    let outcome;
    await act(async () => {
      outcome = await result.current.mutateAsync('Đăng nhập bằng Face ID');
    });

    expect(outcome).toEqual({ kind: 'expired' });
    await waitFor(() => {
      expect(useAuthStore.getState().biometricEnabled).toBe(false);
    });
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(GATED_KEY);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(ENABLED_KEY);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
