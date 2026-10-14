import { PERMISSIONS, type Permission } from '@cms/shared-types';
import { Building2, Clock, LayoutDashboard, Users, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Bỏ trống nghĩa là ai đăng nhập cũng thấy. */
  permission?: Permission;
  /**
   * Quyền chỉ xét ở phạm vi **global** (vd `attendance.config_read`). Với các quyền này,
   * kiểm thẳng `grants.global` để Admin phòng không lọt (xem decisions.md 2026-10-12).
   */
  globalOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard },
  { to: '/users', label: 'Người dùng', icon: Users, permission: PERMISSIONS.USER_READ },
  { to: '/departments', label: 'Phòng ban', icon: Building2, permission: PERMISSIONS.DEPARTMENT_READ },
  {
    to: '/settings/attendance',
    label: 'Chấm công',
    icon: Clock,
    permission: PERMISSIONS.ATTENDANCE_CONFIG_READ,
    globalOnly: true,
  },
];
