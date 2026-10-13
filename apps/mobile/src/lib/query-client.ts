import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api-error';

/**
 * QueryClient dùng chung. Không retry với lỗi 4xx (client tự gây) — đặc biệt
 * 401 đã được interceptor xử lý refresh, retry thêm ở đây là thừa.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
      staleTime: 30_000,
    },
    mutations: {
      retry: false,
    },
  },
});
