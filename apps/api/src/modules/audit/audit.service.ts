import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ghi nhật ký thao tác quản trị. Truyền `tx` để ghi trong cùng transaction với thao tác. */
  log(
    entry: { actorId: string | null; action: string; entityType: string; entityId?: string; before?: unknown; after?: unknown },
    tx: Tx = this.prisma,
  ) {
    return tx.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: (entry.before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  /** Ghi sự kiện cho analytics. */
  event(
    entry: { userId: string; eventType: string; departmentId?: string; entityId?: string; metadata?: unknown },
    tx: Tx = this.prisma,
  ) {
    return tx.activityEvent.create({
      data: {
        userId: entry.userId,
        eventType: entry.eventType,
        departmentId: entry.departmentId,
        entityId: entry.entityId,
        metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
