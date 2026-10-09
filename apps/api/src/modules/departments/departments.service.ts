import { ConflictException, Injectable } from '@nestjs/common';
import { PERMISSIONS } from '@cms/shared-types';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { departmentsWithPermission } from '../rbac/rbac.service';
import { CreateDepartmentDto } from './dto';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthUser) {
    const allowed = departmentsWithPermission(actor.grants, PERMISSIONS.DEPARTMENT_READ);
    const departments = await this.prisma.department.findMany({
      where: { deletedAt: null, ...(allowed === 'all' ? {} : { id: { in: allowed } }) },
      include: { _count: { select: { members: true } } },
      orderBy: { name: 'asc' },
    });
    return departments.map(({ _count, ...d }) => ({ ...d, memberCount: _count.members }));
  }

  async create(actor: AuthUser, dto: CreateDepartmentDto) {
    if (await this.prisma.department.findUnique({ where: { code: dto.code } })) {
      throw new ConflictException('Mã phòng ban đã tồn tại');
    }
    return this.prisma.$transaction(async (tx) => {
      const department = await tx.department.create({ data: dto });
      await this.audit.log(
        { actorId: actor.id, action: 'department.create', entityType: 'department', entityId: department.id, after: dto },
        tx,
      );
      return department;
    });
  }
}
