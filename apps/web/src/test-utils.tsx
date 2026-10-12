import { DEFAULT_ROLES, type MeResponse, type PermissionGrants, type RoleCode } from '@cms/shared-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { useAuthStore } from '@/features/auth/auth-store';

export function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

/** Đặt phiên đăng nhập giả vào Zustand store (quyền ở FE lấy từ store, không qua API). */
export function loginWithGrants(grants: PermissionGrants) {
  useAuthStore.setState({
    accessToken: 'test-access',
    refreshToken: 'test-refresh',
    user: { id: 'u-1', email: 'u@test.local', fullName: 'Người dùng test', roles: [], grants } satisfies MeResponse,
  });
}

export function permissionsOf(role: RoleCode) {
  return DEFAULT_ROLES.find((r) => r.code === role)?.permissions ?? [];
}
