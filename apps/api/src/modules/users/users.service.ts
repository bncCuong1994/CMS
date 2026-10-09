import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PERMISSIONS, ROLES } from '@cms/shared-types';
import * as argon2 from 'argon2';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { departmentsWithPermission } from '../rbac/rbac.service';
import { CreateUserDto } from './dto';

const USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  position: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  departments: { select: { department: { select: { id: true, name: true } } } },
  roles: { select: { scopeId: true, role: { select: { code: true } } } },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Danh sách người dùng trong các phòng ban mà người gọi có quyền xem. */
  async list(actor: AuthUser, departmentId?: string) {
    const allowed = departmentsWithPermission(actor.grants, PERMISSIONS.USER_READ);
    if (departmentId && allowed !== 'all' && !allowed.includes(departmentId)) {
      throw new ForbiddenException('Không có quyền xem phòng ban này');
    }
    const scope = departmentId ? [departmentId] : allowed;
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(scope === 'all' ? {} : { departments: { some: { departmentId: { in: scope } } } }),
      },
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return users.map(({ departments, roles, ...u }) => ({
      ...u,
      departments: departments.map((d) => d.department),
      roles: roles.map((r) => ({ role: r.role.code, departmentId: r.scopeId })),
    }));
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
}
