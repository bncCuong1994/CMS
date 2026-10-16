import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { AxiosAdapter } from 'axios';
import { createElement, type ReactNode } from 'react';
import { Alert, StyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { http } from '@/lib/http';
import { useAuthStore } from './auth-store';
import { LoginForm } from './login-form';

// Khả năng sinh trắc hỏi máy bằng native API (async). Ở các test LoginForm dưới đây
// ta không kiểm luồng Face ID → mock trả null để tránh async setState lúc mount.
// Ẩn/hiện nút Face ID ở đây phụ thuộc biometricEnabled (mặc định false) nên vẫn đúng.
jest.mock('./use-biometric-capability', () => ({
  useBiometricCapability: () => null,
}));

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

function renderForm(
  onSuccess = jest.fn(),
  extra: { onCoverEyesChange?: jest.Mock; onLoginFailed?: jest.Mock } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const ui = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  render(
    createElement(ui, null, createElement(LoginForm, { onSuccess, ...extra })),
  );
  return { onSuccess, ...extra };
}

describe('LoginForm (AC1/AC3)', () => {
  beforeEach(() => {
    (SecureStore as MockSecureStore).__reset();
    jest.clearAllMocks();
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      user: null,
      hydrated: true,
      biometricEnabled: false,
    });
  });

  // useBiometricCapability hỏi khả năng sinh trắc của máy (async) khi mount →
  // setState sau khi render. Drain một tick trong act() để không rò cảnh báo act(...).
  afterEach(async () => {
    await act(async () => {
      await Promise.resolve();
    });
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

  it('báo lỗi đăng nhập ra ngoài để logo panda lắc đầu', async () => {
    http.defaults.adapter = errAdapter(401, { message: 'Email hoặc mật khẩu không đúng' });
    const onLoginFailed = jest.fn();
    renderForm(jest.fn(), { onLoginFailed });

    fireEvent.changeText(screen.getByLabelText('Email'), 'a@b.vn');
    fireEvent.changeText(screen.getByLabelText('Mật khẩu'), 'wrong');
    fireEvent.press(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => expect(onLoginFailed).toHaveBeenCalledTimes(1));
  });

  it('không báo lỗi đăng nhập khi form chưa hợp lệ (chưa gọi API)', async () => {
    const onLoginFailed = jest.fn();
    renderForm(jest.fn(), { onLoginFailed });

    fireEvent.press(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => expect(screen.getByText('Vui lòng nhập email')).toBeTruthy());
    expect(onLoginFailed).not.toHaveBeenCalled();
  });

  it('panda che mắt khi nhập mật khẩu đang ẩn; bỏ che khi hiện mật khẩu hoặc rời ô', () => {
    const onCoverEyesChange = jest.fn();
    renderForm(jest.fn(), { onCoverEyesChange });
    const password = screen.getByLabelText('Mật khẩu');

    fireEvent(password, 'focus');
    expect(onCoverEyesChange).toHaveBeenLastCalledWith(true);

    fireEvent.press(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(onCoverEyesChange).toHaveBeenLastCalledWith(false);

    fireEvent.press(screen.getByRole('button', { name: 'Ẩn mật khẩu' }));
    expect(onCoverEyesChange).toHaveBeenLastCalledWith(true);

    fireEvent(password, 'blur');
    expect(onCoverEyesChange).toHaveBeenLastCalledWith(false);
  });

  it('không che mắt khi đang nhập email', () => {
    const onCoverEyesChange = jest.fn();
    renderForm(jest.fn(), { onCoverEyesChange });

    fireEvent(screen.getByLabelText('Email'), 'focus');
    expect(onCoverEyesChange).not.toHaveBeenCalledWith(true);
  });

  // Regression: trên iOS, nếu bật/tắt shadow + elevation của View bọc TextInput ngay
  // trong onFocus thì bàn phím rớt focus. Bóng đổ phải TĨNH (có sẵn và không đổi khi focus),
  // chỉ borderColor được đổi. Test khoá bất biến này để tránh tái phát.
  it('bóng đổ của ô nhập không đổi khi focus (chống rớt focus trên iOS)', () => {
    renderForm();
    const email = screen.getByLabelText('Email');
    const box = screen.getByTestId('field-box-Email');

    const shadowBefore = StyleSheet.flatten(box.props.style).shadowColor;
    const elevationBefore = StyleSheet.flatten(box.props.style).elevation;
    expect(shadowBefore).toBeDefined();

    fireEvent(email, 'focus');

    const flat = StyleSheet.flatten(box.props.style);
    expect(flat.shadowColor).toBe(shadowBefore);
    expect(flat.elevation).toBe(elevationBefore);
    // borderColor VẪN được phép đổi để báo đang nhập (đây là cách báo focus an toàn).
    expect(flat.borderColor).toBeDefined();
  });

  it('Quên mật khẩu đang giữ chỗ: bấm thì báo đang phát triển', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    renderForm();

    fireEvent.press(screen.getByText('Quên mật khẩu?'));

    expect(alert).toHaveBeenCalledWith('Quên mật khẩu', 'Tính năng đang được phát triển.');
    alert.mockRestore();
  });

  it('AC1/AC9 — chưa bật Face ID: không hiện nút Đăng nhập bằng Face ID', () => {
    renderForm(); // biometricEnabled = false mặc định
    expect(screen.queryByRole('button', { name: /Đăng nhập bằng/ })).toBeNull();
  });
});
