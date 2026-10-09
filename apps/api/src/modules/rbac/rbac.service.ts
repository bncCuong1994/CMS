import { Injectable } from '@nestjs/common';
import type { Permission, PermissionGrants, RoleCode, UserRoleAssignment } from '@cms/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  private findAssignments(userId: string) {
    return this.prisma.userRole.findMany({
      where: { userId, OR: [{ scopeType: 'global' }, { department: { deletedAt: null } }] },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        department: { select: { id: true, name: true } },
      },
    });
  }

  /** Gộp quyền của mọi vai trò người dùng đang có, theo phạm vi. */
  async getGrants(userId: string): Promise<PermissionGrants> {
    const assignments = await this.findAssignments(userId);
    const global = new Set<Permission>();
    const departments: Record<string, Set<Permission>> = {};
    for (const a of assignments) {
      const perms = a.role.permissions.map((rp) => rp.permission.code as Permission);
      if (a.scopeType === 'global') {
        perms.forEach((p) => global.add(p));
      } else if (a.scopeId) {
        const set = (departments[a.scopeId] ??= new Set());
        perms.forEach((p) => set.add(p));
      }
    }
    return {
      global: [...global],
      departments: Object.fromEntries(Object.entries(departments).map(([id, s]) => [id, [...s]])),
    };
  }

  async getRoleAssignments(userId: string): Promise<UserRoleAssignment[]> {
    const assignments = await this.findAssignments(userId);
    return assignments.map((a) => ({
      role: a.role.code as RoleCode,
      departmentId: a.department?.id ?? null,
      departmentName: a.department?.name ?? null,
    }));
  }
}

/** Danh sách phòng ban mà người dùng có quyền `permission`; `'all'` nếu có quyền global. */
export function departmentsWithPermission(grants: PermissionGrants, permission: Permission): string[] | 'all' {
  if (grants.global.includes(permission)) return 'all';
  return Object.entries(grants.departments)
    .filter(([, perms]) => perms.includes(permission))
    .map(([id]) => id);
}
