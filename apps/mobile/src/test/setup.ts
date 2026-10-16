// Mock expo-secure-store bằng Map trong bộ nhớ cho test (không chạm Keychain thật).
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __reset: () => store.clear(),
  };
});

// Mock expo-local-authentication: sinh trắc là native-only, không chạy trong jest-expo.
// Mặc định: máy có phần cứng, đã đăng ký Face ID, authenticate thành công.
// Từng test điều chỉnh qua __setBiometric({...}) để phủ AC3/AC4/AC5/AC6/AC9.
jest.mock('expo-local-authentication', () => {
  const AuthenticationType = { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 };
  const state = {
    hasHardware: true,
    isEnrolled: true,
    types: [AuthenticationType.FACIAL_RECOGNITION] as number[],
    authSuccess: true,
  };
  return {
    AuthenticationType,
    hasHardwareAsync: jest.fn(async () => state.hasHardware),
    isEnrolledAsync: jest.fn(async () => state.isEnrolled),
    supportedAuthenticationTypesAsync: jest.fn(async () => state.types),
    authenticateAsync: jest.fn(async () => ({ success: state.authSuccess })),
    __setBiometric: (patch: Partial<typeof state>) => Object.assign(state, patch),
    __resetBiometric: () =>
      Object.assign(state, {
        hasHardware: true,
        isEnrolled: true,
        types: [AuthenticationType.FACIAL_RECOGNITION],
        authSuccess: true,
      }),
  };
});
