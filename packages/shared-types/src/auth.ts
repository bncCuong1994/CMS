import type { Permission } from './permissions';
import type { RoleCode } from './roles';

/** Quyền của người dùng: `global` áp dụng mọi nơi, `departments` theo từng phòng ban. */
export interface PermissionGrants {
  global: Permission[];
  departments: Record<string, Permission[]>;
}

export interface UserRoleAssignment {
  role: RoleCode;
  departmentId: string | null;
  departmentName: string | null;
}

export interface MeResponse {
  id: string;
  email: string;
  fullName: string;
  roles: UserRoleAssignment[];
  grants: PermissionGrants;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: MeResponse;
}

export function hasPermission(
  grants: PermissionGrants,
  permission: Permission,
  departmentId?: string | null,
): boolean {
  if (grants.global.includes(permission)) return true;
  if (departmentId) return grants.departments[departmentId]?.includes(permission) ?? false;
  return Object.values(grants.departments).some((perms) => perms.includes(permission));
}
