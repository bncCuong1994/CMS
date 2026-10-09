/** Mã quyền dạng `tài_nguyên.hành_động`. Thêm quyền mới ở đây rồi chạy lại seed. */
export const PERMISSIONS = {
  USER_READ: 'user.read',
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_LOCK: 'user.lock',
  DEPARTMENT_READ: 'department.read',
  DEPARTMENT_MANAGE: 'department.manage',
  ROLE_MANAGE: 'role.manage',
  TASK_READ: 'task.read',
  TASK_CREATE: 'task.create',
  TASK_ASSIGN: 'task.assign',
  TASK_UPDATE_OWN: 'task.update_own',
  TASK_UPDATE_ANY: 'task.update_any',
  TASK_TYPE_MANAGE: 'task_type.manage',
  ANALYTICS_READ: 'analytics.read',
  AUDIT_READ: 'audit.read',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  'user.read': 'Xem danh sách người dùng',
  'user.create': 'Tạo tài khoản',
  'user.update': 'Sửa thông tin, đổi vai trò người dùng',
  'user.lock': 'Khoá/mở khoá tài khoản',
  'department.read': 'Xem phòng ban',
  'department.manage': 'Tạo, sửa, xoá phòng ban',
  'role.manage': 'Chỉnh quyền của vai trò',
  'task.read': 'Xem công việc của phòng',
  'task.create': 'Tạo công việc',
  'task.assign': 'Giao việc cho người khác',
  'task.update_own': 'Cập nhật việc được giao cho mình',
  'task.update_any': 'Cập nhật mọi việc trong phòng',
  'task_type.manage': 'Quản lý loại công việc của phòng',
  'analytics.read': 'Xem báo cáo, số liệu',
  'audit.read': 'Xem nhật ký hệ thống',
};
