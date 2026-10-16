import type { LoginResponse } from '@cms/shared-types';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '@/lib/api-error';
import { authenticate } from '@/lib/biometric';
import { http } from '@/lib/http';
import { loadBiometricRefreshToken } from '@/lib/secure-store';
import { useAuthStore } from './auth-store';

/** Kết quả mở lại app bằng Face ID (để UI quyết hiển thị). */
export type BiometricLoginOutcome =
  | { kind: 'success' }
  /** Người dùng huỷ / sinh trắc thất bại → ở lại, cho gõ mật khẩu (AC5). */
  | { kind: 'cancelled' }
  /** Refresh token bị thu hồi/hết hạn (401) → đã xoá phiên + cờ (AC6). */
  | { kind: 'expired' };

/** Refresh không trả `user` → dùng Pick thay vì khai lại kiểu. */
type RefreshResponse = Pick<LoginResponse, 'accessToken' | 'refreshToken'>;

/**
 * Mở lại app bằng Face ID (AC4/AC5/AC6):
 * 1. authenticate() — cổng sinh trắc local; huỷ/thất bại → 'cancelled' (AC5).
 * 2. Đọc refresh token đã khoá sinh trắc.
 * 3. POST /auth/refresh → lưu đè cả access + refresh mới (token xoay vòng).
 * 4. Ghi đè refresh token mới vào khe gated để lần sau vẫn mở được.
 * 5. 401 → xoá phiên + cờ → 'expired' (AC6).
 *
 * KHÔNG log token/mật khẩu ở bất kỳ nhánh nào (AC10).
 */
export function useBiometricLogin() {
  const setTokens = useAuthStore((s) => s.setTokens);
  const enableBiometric = useAuthStore((s) => s.enableBiometric);
  const clear = useAuthStore((s) => s.clear);

  return useMutation<BiometricLoginOutcome, never, string>({
    mutationFn: async (promptMessage): Promise<BiometricLoginOutcome> => {
      const unlocked = await authenticate(promptMessage);
      if (!unlocked) return { kind: 'cancelled' };

      const refreshToken = await loadBiometricRefreshToken();
      if (!refreshToken) {
        // Không đọc được khe gated (chưa bật / đọc lỗi) → coi như huỷ, giữ phiên.
        return { kind: 'cancelled' };
      }

      try {
        const res = await http.post<RefreshResponse>('/auth/refresh', { refreshToken });
        await setTokens(res.data);
        // Token xoay vòng: khe gated phải theo refresh token mới nhất.
        await enableBiometric();
        return { kind: 'success' };
      } catch (error) {
        const apiError = error instanceof ApiError ? error : null;
        if (apiError?.status === 401) {
          await clear();
          return { kind: 'expired' };
        }
        // Lỗi mạng/khác: KHÔNG xoá cờ (chưa chắc token hỏng) → cho thử lại / gõ mật khẩu.
        return { kind: 'cancelled' };
      }
    },
  });
}
