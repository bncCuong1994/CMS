import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import type { Mutation, Query } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from './api-error';

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
  const status = error instanceof ApiError ? error.status : -1;
  return status === 0 || status >= 500;
}

function handleQueryError(error: Error, query: Query<unknown, unknown, unknown>): void {
  if (query.meta?.skipErrorToast) return;
  // Chỉ toast khi refetch nền lỗi (đã có data trước đó), không toast lần đầu
  if (query.state.data === undefined) return;
  // Không toast 401 — interceptor đã lo toast "hết hạn" và clear phiên
  if (error instanceof ApiError && error.status === 401) return;
  const message = error instanceof ApiError ? error.message : 'Có lỗi xảy ra, thử lại sau';
  toast.error(message);
}

function handleMutationError(
  error: Error,
  _variables: unknown,
  _context: unknown,
  mutation: Mutation<unknown, unknown, unknown>,
): void {
  if (mutation.meta?.skipErrorToast) return;
  const message = error instanceof ApiError ? error.message : 'Có lỗi xảy ra, thử lại sau';
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
