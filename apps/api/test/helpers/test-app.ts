import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/main';

/** Các bảng bị xoá sạch giữa các file test. Giữ `_prisma_migrations`. */
const TRUNCATED_TABLES = [
  'users',
  'departments',
  'department_members',
  'roles',
  'permissions',
  'role_permissions',
  'user_roles',
  'refresh_tokens',
  'audit_logs',
  'activity_events',
] as const;

/** Chốt an toàn: chỉ cho phép xoá dữ liệu trên database test. */
export function assertTestDatabase(): void {
  if (!/test/.test(process.env.DATABASE_URL ?? '')) {
    throw new Error('DATABASE_URL phải trỏ tới database test (tên chứa "test")');
  }
}

export function createPrismaClient(): PrismaClient {
  assertTestDatabase();
  return new PrismaClient();
}

export async function truncateAll(prisma: PrismaClient): Promise<void> {
  assertTestDatabase();
  await prisma.$executeRawUnsafe(`TRUNCATE ${TRUNCATED_TABLES.join(', ')} CASCADE`);
}

/** Khởi động ứng dụng Nest đúng như production (global prefix + ValidationPipe). */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.listen(0);
  return app;
}
