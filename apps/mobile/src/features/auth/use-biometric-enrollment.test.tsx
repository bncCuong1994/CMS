import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from './auth-store';
import { useBiometricEnrollment } from './use-biometric-enrollment';

type MockSecureStore = typeof SecureStore & { __reset: () => void };
type MockBio = typeof LocalAuthentication & {
  __setBiometric: (patch: Record<string, unknown>) => void;
  __resetBiometric: () => void;
};

const GATED_KEY = 'cms.biometricRefreshToken';
const ENABLED_KEY = 'cms.biometricLoginEnabled';

function resetAll() {
  (SecureStore as MockSecureStore).__reset();
  (LocalAuthentication as MockBio).__resetBiometric();
  jest.clearAllMocks();
  useAuthStore.setState({
    accessToken: 'acc',
    refreshToken: 'ref-current',
    user: null,
    hydrated: true,
    biometricEnabled: false,
  });
}

/** Giả lập người dùng bấm một nút trong Alert.alert theo text. */
function tapAlertButton(text: string) {
  const spy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    const btn = buttons?.find((b) => b.text === text);
    btn?.onPress?.();
  });
  return spy;
}

describe('useBiometricEnrollment (AC2/AC3/AC9)', () => {
  beforeEach(resetAll);
  afterEach(() => jest.restoreAllMocks());

  it('AC3 — chọn Bật + sinh trắc OK: lưu refresh token gated + cờ', async () => {
    const alert = tapAlertButton('Bật');

    const { result } = renderHook(() => useBiometricEnrollment());
    await act(async () => {
      await result.current.offerEnrollment();
    });

    expect(alert).toHaveBeenCalled();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(GATED_KEY, 'ref-current', {
      requireAuthentication: true,
    });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(ENABLED_KEY, '1');
    expect(useAuthStore.getState().biometricEnabled).toBe(true);
  });

  it('AC3 — chọn Để sau: không authenticate, không lưu, không bật', async () => {
    tapAlertButton('Để sau');

    const { result } = renderHook(() => useBiometricEnrollment());
    await act(async () => {
      await result.current.offerEnrollment();
    });

    expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(ENABLED_KEY, '1');
    expect(useAuthStore.getState().biometricEnabled).toBe(false);
  });

  it('AC3 — chọn Bật nhưng sinh trắc thất bại: không lưu, không bật', async () => {
    (LocalAuthentication as MockBio).__setBiometric({ authSuccess: false });
    tapAlertButton('Bật');

    const { result } = renderHook(() => useBiometricEnrollment());
    await act(async () => {
      await result.current.offerEnrollment();
    });

    expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(ENABLED_KEY, '1');
    expect(useAuthStore.getState().biometricEnabled).toBe(false);
  });

  it('AC9 — máy không có phần cứng: không mời bật (không hiện Alert)', async () => {
    (LocalAuthentication as MockBio).__setBiometric({ hasHardware: false });
    const alert = jest.spyOn(Alert, 'alert');

    const { result } = renderHook(() => useBiometricEnrollment());
    await act(async () => {
      await result.current.offerEnrollment();
    });

    expect(alert).not.toHaveBeenCalled();
    expect(useAuthStore.getState().biometricEnabled).toBe(false);
  });

  it('AC9 — chưa đăng ký sinh trắc ở OS: không mời bật', async () => {
    (LocalAuthentication as MockBio).__setBiometric({ isEnrolled: false });
    const alert = jest.spyOn(Alert, 'alert');

    const { result } = renderHook(() => useBiometricEnrollment());
    await act(async () => {
      await result.current.offerEnrollment();
    });

    expect(alert).not.toHaveBeenCalled();
  });

  it('đã bật trước đó: không mời lại', async () => {
    useAuthStore.setState({ biometricEnabled: true });
    const alert = jest.spyOn(Alert, 'alert');

    const { result } = renderHook(() => useBiometricEnrollment());
    await act(async () => {
      await result.current.offerEnrollment();
    });

    expect(alert).not.toHaveBeenCalled();
  });
});
