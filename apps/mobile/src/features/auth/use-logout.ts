import { useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { http } from '@/lib/http';
import { useAuthStore } from './auth-store';

/**
 * Đăng xuất: thu hồi refresh token ở backend (nếu còn), rồi xoá token khỏi
 * secure-store. Luôn clear() kể cả khi gọi backend lỗi — UI phải về Đăng nhập.
 */
export function useLogout() {
  const clear = useAuthStore((s) => s.clear);

  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { refreshToken } = useAuthStore.getState();
      if (refreshToken) {
        try {
          await http.post('/auth/logout', { refreshToken });
        } catch {
          // Backend không ném lỗi kể cả token không khớp; nuốt lỗi mạng để vẫn đăng xuất local.
        }
      }
    },
    onSettled: async () => {
      await clear();
      queryClient.clear();
    },
  });
}
