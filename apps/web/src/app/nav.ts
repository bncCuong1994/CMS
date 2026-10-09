import { PERMISSIONS, type Permission } from '@cms/shared-types';
import { Building2, LayoutDashboard, Users, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Bỏ trống nghĩa là ai đăng nhập cũng thấy. */
  permission?: Permission;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard },
  { to: '/users', label: 'Người dùng', icon: Users, permission: PERMISSIONS.USER_READ },
  { to: '/departments', label: 'Phòng ban', icon: Building2, permission: PERMISSIONS.DEPARTMENT_READ },
];
