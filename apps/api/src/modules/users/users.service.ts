import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PERMISSIONS, ROLES } from '@cms/shared-types';
import type { RoleCode } from '@cms/shared-types';
import * as argon2 from 'argon2';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { departmentsWithPermission } from '../rbac/rbac.service';
import { AuthService } from '../auth/auth.service';
import { CreateUserDto, ListUsersQuery, UpdateUserDto, USERS_PAGE_SIZE_DEFAULT, USERS_PAGE_SIZE_MAX } from './dto';

const USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  position: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  departments: { select: { department: { select: { id: true, name: true } } } },
  roles: { select: { scopeId: true, role: { select: { code: true } } } },
} as const;

type UserWithRelations = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

/** Đưa bản ghi user (kèm departments/roles lồng nhau) về đúng shape response của GET /users. */
function toUserResponse({ departments, roles, ...u }: UserWithRelations) {
  return {
    ...u,
    departments: departments.map((d) => d.department),
    roles: roles.map((r) => ({ role: r.role.code, departmentId: r.scopeId })),
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Danh sách người dùng trong các phòng ban mà người gọi có quyền xem.
   * Hỗ trợ tìm kiếm (q), lọc vai trò/trạng thái/phòng ban và phân trang; trả envelope { data, meta }.
   * Thao tác đọc: không ghi audit_logs/activity_events.
   */
  async list(actor: AuthUser, query: ListUsersQuery = {}) {
    const { departmentId, q, role, status } = query;
    const allowed = departmentsWithPermission(actor.grants, PERMISSIONS.USER_READ);
    // Nhiều departmentId: nếu bất kỳ id nào ngoài phạm vi cho phép → 403 (không im lặng bỏ qua).
    if (departmentId && departmentId.length > 0 && allowed !== 'all') {
      if (departmentId.some((id) => !allowed.includes(id))) {
        throw new ForbiddenException('Không có quyền xem phòng ban này');
      }
    }
    const scope = departmentId && departmentId.length > 0 ? departmentId : allowed;

    const page = query.page && query.page >= 1 ? query.page : 1;
    const requested = query.pageSize ?? USERS_PAGE_SIZE_DEFAULT;
    const pageSize = Math.min(Math.max(requested, 1), USERS_PAGE_SIZE_MAX);

    const trimmed = q?.trim();
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(scope === 'all' ? {} : { departments: { some: { departmentId: { in: scope } } } }),
      ...(trimmed
        ? {
            OR: [
              { fullName: { contains: trimmed, mode: 'insensitive' } },
              { email: { contains: trimmed, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(status && status.length > 0 ? { status: { in: status } } : {}),
      ...(role && role.length > 0 ? { roles: { some: { role: { code: { in: role } } } } } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: rows.map(toUserResponse), meta: { total, page, pageSize } };
  }

  async create(actor: AuthUser, dto: CreateUserDto) {
    // Chỉ người có quyền quản lý vai trò toàn hệ thống (Super Admin) mới tạo được Admin.
    if (dto.role === ROLES.ADMIN && !actor.grants.global.includes(PERMISSIONS.ROLE_MANAGE)) {
      throw new ForbiddenException('Chỉ Super Admin được tạo tài khoản Admin');
    }
    const department = await this.prisma.department.findFirst({ where: { id: dto.departmentId, deletedAt: null } });
    if (!department) throw new NotFoundException('Không tìm thấy phòng ban');

    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('Email đã được sử dụng');
    }
    const role = await this.prisma.role.findUniqueOrThrow({ where: { code: dto.role } });
    const passwordHash = await argon2.hash(dto.password);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          fullName: dto.fullName,
          phone: dto.phone,
          position: dto.position,
          passwordHash,
          departments: { create: { departmentId: department.id } },
          roles: { create: { roleId: role.id, scopeType: 'department', scopeId: department.id, grantedBy: actor.id } },
        },
        select: { id: true, email: true, fullName: true, status: true },
      });
      await this.audit.log(
        {
          actorId: actor.id,
          action: 'user.create',
          entityType: 'user',
          entityId: user.id,
          after: { email, role: dto.role, departmentId: department.id },
        },
        tx,
      );
      return user;
    });
  }

  /**
   * Sửa bán phần người dùng (US-USERS-04): thông tin cơ bản, tập phòng ban và vai trò theo phòng.
   * Phạm vi tính theo phòng của người bị sửa (không từ body). Đổi vai trò/phòng → thu hồi refresh token.
   * Ghi audit_logs 'user.update' với before/after. Tất cả trong một transaction.
   */
  async update(actor: AuthUser, id: string, dto: UpdateUserDto) {
    const allowed = departmentsWithPermission(actor.grants, PERMISSIONS.USER_UPDATE);
    const hasRoleManage = actor.grants.global.includes(PERMISSIONS.ROLE_MANAGE);

    const target = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { departments: { select: { departmentId: true } }, roles: true },
    });
    if (!target) throw new NotFoundException('Không tìm thấy người dùng');

    // Phạm vi: target phải thuộc ít nhất một phòng actor quản lý (Super Admin bỏ qua).
    const targetDepartments = target.departments.map((d) => d.departmentId);
    if (allowed !== 'all' && !targetDepartments.some((d) => allowed.includes(d))) {
      throw new ForbiddenException('Không có quyền sửa người dùng này');
    }

    // Chỉ Super Admin (role.manage global) được sửa/đổi vai trò một Admin/Super Admin.
    const currentRoleCode = await this.resolveCurrentRoleCode(target.roles);
    const targetIsPrivileged = currentRoleCode === ROLES.ADMIN || currentRoleCode === ROLES.SUPER_ADMIN;
    if (targetIsPrivileged && !hasRoleManage) {
      throw new ForbiddenException('Chỉ Super Admin được gán vai trò Admin');
    }
    // Chặn nâng lên ADMIN khi không có role.manage global.
    if (dto.role === ROLES.ADMIN && !hasRoleManage) {
      throw new ForbiddenException('Chỉ Super Admin được gán vai trò Admin');
    }

    // Tính tập phòng mới theo thuật toán trong story.
    const nextDepartments = await this.resolveNextDepartments(allowed, targetDepartments, dto.departmentIds);
    const effectiveRoleCode = dto.role ?? currentRoleCode;

    const departmentsChanged =
      dto.departmentIds !== undefined &&
      !sameSet(targetDepartments, nextDepartments);
    const roleChanged = dto.role !== undefined && dto.role !== currentRoleCode;

    const before = {
      fullName: target.fullName,
      phone: target.phone,
      position: target.position,
      departmentIds: [...targetDepartments].sort(),
      role: currentRoleCode,
    };

    const result = await this.prisma.$transaction(async (tx) => {
      const data: Prisma.UserUpdateInput = {};
      if (dto.fullName !== undefined) data.fullName = dto.fullName;
      if (dto.phone !== undefined) data.phone = dto.phone;
      if (dto.position !== undefined) data.position = dto.position;
      if (Object.keys(data).length > 0) {
        await tx.user.update({ where: { id }, data });
      }

      if (departmentsChanged || roleChanged) {
        await this.syncDepartmentRoles(tx, {
          actorId: actor.id,
          userId: id,
          nextDepartments,
          roleCode: effectiveRoleCode,
        });
      }

      // Đổi vai trò hoặc tập phòng → buộc cấp lại grants.
      if (roleChanged || departmentsChanged) {
        await this.authService.revokeAllForUser(id, tx);
      }

      const updated = await tx.user.findFirstOrThrow({ where: { id }, select: USER_SELECT });

      await this.audit.log(
        {
          actorId: actor.id,
          action: 'user.update',
          entityType: 'user',
          entityId: id,
          before,
          after: {
            fullName: updated.fullName,
            phone: updated.phone,
            position: updated.position,
            departmentIds: updated.departments.map((d) => d.department.id).sort(),
            role: effectiveRoleCode,
          },
        },
        tx,
      );
      return updated;
    });

    return toUserResponse(result);
  }

  /** Vai trò hiện tại: ưu tiên global (Super Admin), nếu không lấy vai trò theo phòng. */
  private async resolveCurrentRoleCode(
    roles: { roleId: string; scopeType: string }[],
  ): Promise<RoleCode> {
    const roleIds = [...new Set(roles.map((r) => r.roleId))];
    const roleRows = await this.prisma.role.findMany({ where: { id: { in: roleIds } } });
    const byId = new Map(roleRows.map((r) => [r.id, r.code as RoleCode]));
    const globalRole = roles.find((r) => r.scopeType === 'global');
    if (globalRole) return byId.get(globalRole.roleId) ?? ROLES.USER;
    const deptRole = roles.find((r) => r.scopeType === 'department');
    return (deptRole && byId.get(deptRole.roleId)) ?? ROLES.USER;
  }

  /**
   * Tập phòng mới:
   * - Super Admin (allowed='all'): thay toàn bộ bằng departmentIds.
   * - Admin: mọi departmentIds phải trong phạm vi (sai → 403); giữ phòng ngoài phạm vi.
   * Phòng không tồn tại/đã xoá mềm → 404.
   */
  private async resolveNextDepartments(
    allowed: string[] | 'all',
    current: string[],
    departmentIds: string[] | undefined,
  ): Promise<string[]> {
    if (departmentIds === undefined) return current;
    const requested = [...new Set(departmentIds)];

    if (allowed !== 'all' && requested.some((d) => !allowed.includes(d))) {
      throw new ForbiddenException('Không có quyền gán phòng ban này');
    }

    if (requested.length > 0) {
      const found = await this.prisma.department.findMany({
        where: { id: { in: requested }, deletedAt: null },
        select: { id: true },
      });
      if (found.length !== requested.length) throw new NotFoundException('Không tìm thấy phòng ban');
    }

    if (allowed === 'all') return requested;
    const outOfScope = current.filter((d) => !allowed.includes(d));
    return [...new Set([...outOfScope, ...requested])];
  }

  /**
   * Đồng bộ department_members + user_roles (scope department) về đúng tập phòng & vai trò mới.
   * Không đụng dòng vai trò global. Lịch sử task/log không bị xoá.
   */
  private async syncDepartmentRoles(
    tx: Prisma.TransactionClient,
    args: { actorId: string; userId: string; nextDepartments: string[]; roleCode: RoleCode },
  ) {
    const { actorId, userId, nextDepartments, roleCode } = args;
    const role = await tx.role.findUniqueOrThrow({ where: { code: roleCode } });

    await tx.departmentMember.deleteMany({ where: { userId } });
    await tx.userRole.deleteMany({ where: { userId, scopeType: 'department' } });

    if (nextDepartments.length > 0) {
      await tx.departmentMember.createMany({
        data: nextDepartments.map((departmentId) => ({ departmentId, userId })),
      });
      await tx.userRole.createMany({
        data: nextDepartments.map((departmentId) => ({
          userId,
          roleId: role.id,
          scopeType: 'department' as const,
          scopeId: departmentId,
          grantedBy: actorId,
        })),
      });
    }
  }
}

/** So sánh hai tập phòng (bỏ qua thứ tự/trùng lặp). */
function sameSet(a: string[], b: string[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const v of sa) if (!sb.has(v)) return false;
  return true;
}
