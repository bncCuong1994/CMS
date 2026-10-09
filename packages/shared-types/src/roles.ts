import { ALL_PERMISSIONS, PERMISSIONS as P, type Permission } from './permissions';

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  USER: 'USER',
  INTERN: 'INTERN',
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];

export type ScopeType = 'global' | 'department';

export interface RoleDefinition {
  code: RoleCode;
  name: string;
  description: string;
  /** Super Admin gán ở phạm vi toàn hệ thống, các vai trò khác gán theo phòng ban. */
  scopeType: ScopeType;
  permissions: Permission[];
}

/** Quyền mặc định của 4 vai trò, dùng khi seed. Super Admin có thể chỉnh lại trên giao diện. */
export const DEFAULT_ROLES: RoleDefinition[] = [
  {
    code: ROLES.SUPER_ADMIN,
    name: 'Super Admin',
    description: 'Toàn quyền trên hệ thống',
    scopeType: 'global',
    permissions: ALL_PERMISSIONS,
  },
  {
    code: ROLES.ADMIN,
    name: 'Admin',
    description: 'Quản lý các phòng ban được gán',
    scopeType: 'department',
    permissions: [
      P.USER_READ,
      P.USER_CREATE,
      P.USER_UPDATE,
      P.USER_LOCK,
      P.DEPARTMENT_READ,
      P.TASK_READ,
      P.TASK_CREATE,
      P.TASK_ASSIGN,
      P.TASK_UPDATE_OWN,
      P.TASK_UPDATE_ANY,
      P.TASK_TYPE_MANAGE,
      P.ANALYTICS_READ,
    ],
  },
  {
    code: ROLES.USER,
    name: 'User',
    description: 'Nhân viên làm việc trong phòng',
    scopeType: 'department',
    permissions: [P.USER_READ, P.DEPARTMENT_READ, P.TASK_READ, P.TASK_CREATE, P.TASK_UPDATE_OWN],
  },
  {
    code: ROLES.INTERN,
    name: 'Intern',
    description: 'Thực tập sinh, chỉ làm việc được giao',
    scopeType: 'department',
    permissions: [P.DEPARTMENT_READ, P.TASK_UPDATE_OWN],
  },
];

/** Intern không hoạt động quá số ngày này sẽ bị khoá tự động. */
export const INTERN_INACTIVE_LOCK_DAYS = 30;
