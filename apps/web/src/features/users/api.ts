import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

/**
 * Body bán phần của `PATCH /users/:id` (US-USERS-04). Chỉ trường nào gửi mới cập nhật;
 * `phone`/`position` nhận `null` để xoá. `role`/`departmentIds` theo thuật toán phạm vi của BE.
 */
export interface UpdateUserBody {
  fullName?: string;
  phone?: string | null;
  position?: string | null;
  departmentIds?: string[];
  role?: AssignableRole;
}

/**
 * Bộ lọc + phân trang gửi lên `GET /users` (US-USERS-03). Mọi điều kiện đi lên server,
 * không lọc/phân trang ở client. Trường rỗng/undefined thì không gửi query param.
 *
 * `role`, `status`, `departmentId` là **chọn nhiều** (mảng). Mảng rỗng → không gửi param.
 * Nhiều giá trị serialize thành **phẩy-ngăn-cách** (`?role=USER,INTERN`) — BE chấp nhận cả
 * dạng phẩy lẫn lặp tham số, chuẩn hoá về mảng; trong một bộ lọc ghép OR.
 */
export interface UsersQuery {
  q?: string;
  role?: string[];
  status?: UserRow['status'][];
  departmentId?: string[];
  page?: number;
  pageSize?: number;
}

/**
 * Envelope phân trang của `GET /users` (US-USERS-03). NỢ: `packages/shared-types` chưa có
 * DTO này — khi shared-types bổ sung (US-USERS-02) thì đổi sang import, không sửa `packages/`.
 */
export interface PaginatedUsers {
  data: UserRow[];
  meta: { total: number; page: number; pageSize: number };
}

export const userKeys = {
  all: ['users'] as const,
  list: (params: UsersParams) => [...userKeys.all, 'list', params] as const,
};

/** Dạng đã serialize để gửi axios `params` và làm queryKey (ổn định, bỏ trường rỗng). */
type UsersParams = Record<string, string | number>;

/**
 * Serialize mảng bộ lọc thành chuỗi phẩy-ngăn-cách, **sắp xếp trước** để queryKey ổn định
 * (chọn `[USER, INTERN]` và `[INTERN, USER]` ra cùng một key → không nhân đôi cache).
 * Mảng rỗng/không có phần tử → trả `undefined` để bỏ hẳn param.
 */
function serializeMulti(values: readonly string[] | undefined): string | undefined {
  if (!values || values.length === 0) return undefined;
  return [...values].sort().join(',');
}

/** Bỏ các trường rỗng/undefined để query param và queryKey gọn, ổn định. */
function toParams(query: UsersQuery): UsersParams {
  const params: UsersParams = {};
  if (query.q?.trim()) params.q = query.q.trim();

  const role = serializeMulti(query.role);
  if (role) params.role = role;

  const status = serializeMulti(query.status);
  if (status) params.status = status;

  const departmentId = serializeMulti(query.departmentId);
  if (departmentId) params.departmentId = departmentId;

  if (query.page) params.page = query.page;
  if (query.pageSize) params.pageSize = query.pageSize;
  return params;
}

export function useUsers(query: UsersQuery = {}) {
  const params = toParams(query);
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => api.get<PaginatedUsers>('/users', { params }),
    placeholderData: keepPreviousData,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUserBody) => api.post<CreateUserResponse>('/users', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
    meta: { skipErrorToast: true },
  });
}

/**
 * `PATCH /users/:id` (US-USERS-04). Trả về người dùng sau khi sửa theo `USER_SELECT`
 * (giống item của `GET /users`). `skipErrorToast` để dialog tự xử 403/404 tại chỗ.
 */
export function useUpdateUser(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateUserBody) => api.patch<UserRow>(`/users/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
    meta: { skipErrorToast: true },
  });
}
