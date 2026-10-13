import * as SecureStore from 'expo-secure-store';

/**
 * Lưu/đọc/xoá token qua expo-secure-store (Keychain trên iOS, Keystore trên Android).
 * KHÔNG dùng AsyncStorage thường, KHÔNG log giá trị token ra console/Flipper.
 */

const ACCESS_TOKEN_KEY = 'cms.accessToken';
const REFRESH_TOKEN_KEY = 'cms.refreshToken';

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

/** Xoá sạch token khỏi secure-store (đăng xuất / refresh thất bại). */
export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}
