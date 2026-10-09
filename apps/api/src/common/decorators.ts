import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Permission, PermissionGrants } from '@cms/shared-types';

export const IS_PUBLIC_KEY = 'isPublic';
/** Bỏ qua xác thực JWT cho endpoint này. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const PERMISSION_KEY = 'requiredPermission';

export interface PermissionRequirement {
  permission: Permission;
  /**
   * Lấy id phòng ban của tài nguyên từ request (params, query hoặc body) để kiểm tra phạm vi.
   * Bỏ trống nghĩa là chỉ cần có quyền ở ít nhất một phòng; service tự lọc dữ liệu theo phạm vi.
   */
  departmentFrom?: { source: 'params' | 'query' | 'body'; key: string };
  /** Chỉ cho phép quyền ở phạm vi global (Super Admin). */
  globalOnly?: boolean;
}

export const RequirePermission = (
  permission: Permission,
  options: Omit<PermissionRequirement, 'permission'> = {},
) => SetMetadata(PERMISSION_KEY, { permission, ...options } satisfies PermissionRequirement);

/** Người dùng đã xác thực, gắn vào request bởi JwtAuthGuard. */
export interface AuthUser {
  id: string;
  email: string;
  grants: PermissionGrants;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
