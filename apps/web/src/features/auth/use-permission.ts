import { hasPermission, type Permission } from '@cms/shared-types';
import { useAuthStore } from './auth-store';

/** Kiểm tra quyền để ẩn/hiện giao diện. Bảo mật thật nằm ở backend. */
export function usePermission(permission: Permission, departmentId?: string | null): boolean {
  const grants = useAuthStore((s) => s.user?.grants);
  return grants ? hasPermission(grants, permission, departmentId) : false;
}
