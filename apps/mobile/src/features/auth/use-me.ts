import type { MeResponse } from '@cms/shared-types';
import { useQuery } from '@tanstack/react-query';
import { toApiError } from '@/lib/api-error';
import { http } from '@/lib/http';
import { useAuthStore } from './auth-store';

export const meQueryKey = ['auth', 'me'] as const;

/**
 * Lấy/làm tươi thông tin người dùng + grants từ GET /auth/me.
 * Chỉ chạy khi đã có accessToken. Đồng bộ kết quả vào store để UI đọc nhất quán.
 */
export function useMe() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);

  return useQuery({
    queryKey: meQueryKey,
    enabled: Boolean(accessToken),
    queryFn: async (): Promise<MeResponse> => {
      try {
        const res = await http.get<MeResponse>('/auth/me');
        setUser(res.data);
        return res.data;
      } catch (error) {
        throw toApiError(error);
      }
    },
  });
}
