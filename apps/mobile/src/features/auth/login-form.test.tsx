import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { AxiosAdapter } from 'axios';
import { createElement, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { http } from '@/lib/http';
import { useAuthStore } from './auth-store';
import { LoginForm } from './login-form';

type MockSecureStore = typeof SecureStore & { __reset: () => void };

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

function renderForm(onSuccess = jest.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const ui = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  render(
    createElement(ui, null, createElement(LoginForm, { onSuccess })),
  );
  return { onSuccess };
}

describe('LoginForm (AC1/AC3)', () => {
  beforeEach(() => {
    (SecureStore as MockSecureStore).__reset();
    jest.clearAllMocks();
    useAuthStore.setState({ accessToken: null, refreshToken: null, user: null, hydrated: true });
  });

  it('AC1 — hiện trường Email, Mật khẩu và nút Đăng nhập', () => {
    renderForm();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Mật khẩu')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeTruthy();
  });

  it('AC3 — sai mật khẩu hiện message backend, không điều hướng', async () => {
    http.defaults.adapter = errAdapter(401, { message: 'Email hoặc mật khẩu không đúng' });
    const { onSuccess } = renderForm();

    fireEvent.changeText(screen.getByLabelText('Email'), 'a@b.vn');
    fireEvent.changeText(screen.getByLabelText('Mật khẩu'), 'wrong');
    fireEvent.press(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => {
      expect(screen.getByText('Email hoặc mật khẩu không đúng')).toBeTruthy();
    });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
