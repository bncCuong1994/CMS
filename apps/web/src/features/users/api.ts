import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AssignableRole } from './schemas';

/**
 * Kiểu của `GET /users`. `packages/shared-types` chưa có DTO cho users nên tạm khai ở đây;
 * khi shared-types bổ sung thì đổi sang import (không được sửa `packages/` trong story này).
 */
export interface UserRow {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  position: string | null;
  status: 'active' | 'inactive' | 'locked';
  lastLoginAt: string | null;
  departments: { id: string; name: string }[];
  roles: { role: string; departmentId: string | null }[];
}

export interface CreateUserBody {
  email: string;
  fullName: string;
  password: string;
  phone?: string;
  position?: string;
  departmentId: string;
  role: AssignableRole;
}

/** `POST /users` chỉ trả 4 trường này — **không** có `phone` (xem US-USERS-01). */
export interface CreateUserResponse {
  id: string;
  email: string;
  fullName: string;
  status: UserRow['status'];
}

export const userKeys = {
  all: ['users'] as const,
};

export function useUsers() {
  return useQuery({ queryKey: userKeys.all, queryFn: () => api.get<UserRow[]>('/users') });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUserBody) => api.post<CreateUserResponse>('/users', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
    meta: { skipErrorToast: true },
  });
}
