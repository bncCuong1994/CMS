import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from './auth-store';

type MockSecureStore = typeof SecureStore & { __reset: () => void };

const ACCESS_KEY = 'cms.accessToken';
const REFRESH_KEY = 'cms.refreshToken';

function resetAll() {
  (SecureStore as MockSecureStore).__reset();
  jest.clearAllMocks();
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    user: null,
    hydrated: false,
  });
}

describe('auth-store (secure-store)', () => {
  beforeEach(resetAll);

  it('setSession lưu cả token lẫn user vào secure-store (AC2)', async () => {
    await useAuthStore.getState().setSession({
      accessToken: 'acc-1',
      refreshToken: 'ref-1',
      user: {
        id: 'u1',
        email: 'a@b.vn',
        fullName: 'Nguyễn Văn A',
        roles: [{ role: 'USER', departmentId: null, departmentName: null }],
        grants: { global: [], departments: {} },
      },
    });

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(ACCESS_KEY, 'acc-1');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(REFRESH_KEY, 'ref-1');
    expect(useAuthStore.getState().accessToken).toBe('acc-1');
    expect(useAuthStore.getState().user?.fullName).toBe('Nguyễn Văn A');
  });

  it('setTokens ghi đè cả hai token (refresh xoay vòng — AC6)', async () => {
    await useAuthStore.getState().setTokens({ accessToken: 'acc-2', refreshToken: 'ref-2' });

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(ACCESS_KEY, 'acc-2');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(REFRESH_KEY, 'ref-2');
    expect(useAuthStore.getState().refreshToken).toBe('ref-2');
  });

  it('hydrate nạp token đã lưu khi mở lại app (AC5)', async () => {
    await useAuthStore.getState().setTokens({ accessToken: 'acc-3', refreshToken: 'ref-3' });
    useAuthStore.setState({ accessToken: null, refreshToken: null, hydrated: false });

    await useAuthStore.getState().hydrate();

    expect(useAuthStore.getState().accessToken).toBe('acc-3');
    expect(useAuthStore.getState().hydrated).toBe(true);
  });

  it('clear xoá token khỏi secure-store (AC7)', async () => {
    await useAuthStore.getState().setTokens({ accessToken: 'acc-4', refreshToken: 'ref-4' });

    await useAuthStore.getState().clear();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(ACCESS_KEY);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(REFRESH_KEY);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
