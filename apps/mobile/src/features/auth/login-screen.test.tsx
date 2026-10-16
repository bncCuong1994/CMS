import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from './auth-store';
import { LoginScreen } from './login-screen';

// LoginForm (bên trong LoginScreen) hỏi khả năng sinh trắc async khi mount.
// Màn này chỉ kiểm hoạt cảnh mở app, không kiểm Face ID → mock trả null.
jest.mock('./use-biometric-capability', () => ({
  useBiometricCapability: () => null,
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      SafeAreaProvider,
      { initialMetrics: metrics },
      createElement(QueryClientProvider, { client }, children),
    );
  render(createElement(wrapper, null, createElement(LoginScreen, { onSuccess: jest.fn() })));
}

describe('LoginScreen — màn mở app panda', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, refreshToken: null, user: null, hydrated: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('mở màn: panda đi bộ và câu "Let\'s get to work" xuất hiện', () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    renderScreen();

    expect(screen.getByLabelText('Panda xách laptop đang đi làm')).toBeTruthy();
    expect(screen.getByLabelText("Let's get to work")).toBeTruthy();
    expect(screen.getByLabelText('Panda CMS')).toBeTruthy();
  });

  it('bật Giảm chuyển động: bỏ qua đoạn mở đầu, vào thẳng form với logo', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    renderScreen();

    // Đợi promise isReduceMotionEnabled() trả về và React áp dụng state mới.
    await act(async () => {});
    expect(screen.queryByLabelText('Panda xách laptop đang đi làm')).toBeNull();
    expect(screen.getByLabelText('Panda CMS')).toBeTruthy();
    expect(screen.getByText('Chào mừng trở lại')).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeTruthy();
  });
});
