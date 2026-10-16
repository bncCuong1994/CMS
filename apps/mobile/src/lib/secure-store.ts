import * as SecureStore from 'expo-secure-store';

/**
 * Lưu/đọc/xoá token qua expo-secure-store (Keychain trên iOS, Keystore trên Android).
 * KHÔNG dùng AsyncStorage thường, KHÔNG log giá trị token ra console/Flipper.
 */

const ACCESS_TOKEN_KEY = 'cms.accessToken';
const REFRESH_TOKEN_KEY = 'cms.refreshToken';
// Khe refresh token YÊU CẦU SINH TRẮC — dùng cho Face ID đăng nhập (US-ATT-08).
// Tách khe riêng để phiên thường và phiên-đã-bật-Face-ID không ghi đè nhau.
const BIOMETRIC_REFRESH_TOKEN_KEY = 'cms.biometricRefreshToken';
const BIOMETRIC_ENABLED_KEY = 'cms.biometricLoginEnabled';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

/** Lưu đè cả hai token (refresh token xoay vòng → luôn ghi cặp mới). */
export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
  ]);
}

/** Đọc cặp token; trả null nếu thiếu một trong hai. */
export async function loadTokens(): Promise<StoredTokens | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

/** Xoá cặp token thường khỏi secure-store (đăng xuất / refresh thất bại). */
export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}

// ── Khe refresh token yêu-cầu-sinh-trắc + cờ bật Face ID (US-ATT-08) ─────────

/**
 * Lưu refresh token vào khe yêu-cầu-sinh-trắc + bật cờ biometricLoginEnabled.
 * `requireAuthentication: true` nơi OS hỗ trợ (Keychain/Keystore sẽ bắt sinh trắc
 * khi đọc); tầng app vẫn gate bằng authenticate() trước khi đọc để chắc chắn.
 * KHÔNG bao giờ lưu mật khẩu — chỉ refresh token.
 */
export async function enableBiometricLogin(refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY, refreshToken, {
    requireAuthentication: true,
  });
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, '1');
}

/** Có bật Face ID đăng nhập không (đọc cờ — không chạm khe gated). */
export async function isBiometricLoginEnabled(): Promise<boolean> {
  const flag = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
  return flag === '1';
}

/**
 * Đọc refresh token đã khoá sinh trắc. Gọi SAU khi đã authenticate() ở tầng app.
 * Trả null nếu chưa bật / không có.
 */
export async function loadBiometricRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY, {
    requireAuthentication: true,
  });
}

/** Xoá khe refresh gated + cờ (tắt Face ID / đăng xuất / refresh 401). */
export async function disableBiometricLogin(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY),
  ]);
}
