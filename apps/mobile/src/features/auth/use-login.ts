import type { LoginResponse } from '@cms/shared-types';
import { useMutation } from '@tanstack/react-query';
import { toApiError } from '@/lib/api-error';
import { http } from '@/lib/http';
import { useAuthStore } from './auth-store';

export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Đăng nhập: gọi POST /auth/login, lưu phiên (token + user) vào store/secure-store.
 * Lỗi 401 (sai mật khẩu / tài khoản khoá) → KHÔNG lưu token, ném ApiError để UI hiện message.
 */
export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: async (input: LoginInput): Promise<LoginResponse> => {
      try {
        const res = await http.post<LoginResponse>('/auth/login', input);
        return res.data;
      } catch (error) {
        throw toApiError(error);
      }
    },
    onSuccess: async (data) => {
      await setSession(data);
    },
  });
}
