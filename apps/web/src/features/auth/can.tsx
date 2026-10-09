import type { Permission } from '@cms/shared-types';
import type { ReactNode } from 'react';
import { usePermission } from './use-permission';

export function Can({
  permission,
  departmentId,
  children,
  fallback = null,
}: {
  permission: Permission;
  departmentId?: string | null;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return usePermission(permission, departmentId) ? children : fallback;
}
