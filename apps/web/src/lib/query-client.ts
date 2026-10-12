import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ApiError } from './api-error';

// Mở rộng kiểu meta cho TypeScript — không dùng any
declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      skipErrorToast?: boolean;
    };
    queryMeta: {
      skipErrorToast?: boolean;
    };
  }
}

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  const status = (error as ApiError)?.status ?? -1;
  return status === 0 || status >= 500;
}

function handleQueryError(error: unknown, query: { state: { data: unknown }; meta?: { skipErrorToast?: boolean } }): void {
  if (query.meta?.skipErrorToast) return;
  // Chỉ toast khi refetch nền lỗi (đã có data trước đó), không toast lần đầu
  if (query.state.data === undefined) return;
  // Không toast 401 — interceptor đã lo toast "hết hạn" và clear phiên
  const status = (error as ApiError)?.status;
  if (status === 401) return;
  const message = (error as ApiError)?.message ?? 'Có lỗi xảy ra, thử lại sau';
  toast.error(message);
}

function handleMutationError(
  error: unknown,
  _variables: unknown,
  _context: unknown,
  mutation: { meta?: { skipErrorToast?: boolean } },
): void {
  if (mutation.meta?.skipErrorToast) return;
  const message = (error as ApiError)?.message ?? 'Có lỗi xảy ra, thử lại sau';
  toast.error(message);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: shouldRetry },
    mutations: { retry: 0 },
  },
  queryCache: new QueryCache({ onError: handleQueryError }),
  mutationCache: new MutationCache({ onError: handleMutationError }),
});
