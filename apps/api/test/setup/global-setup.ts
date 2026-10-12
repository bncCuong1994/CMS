import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

const API_ROOT = path.resolve(__dirname, '../..');

/** Tên database test: phải chứa "test" vì các spec có chốt an toàn trước khi TRUNCATE. */
const TEST_DATABASE = 'cms_test';

/**
 * Dựng PostgreSQL 17 thật bằng Testcontainers rồi chạy migration.
 * `--runInBand` nên process.env đặt ở đây dùng được trong mọi spec.
 */
export default async function globalSetup(): Promise<void> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:17-alpine')
    .withDatabase(TEST_DATABASE)
    .withUsername('cms')
    .withPassword('cms')
    .start();

  const databaseUrl = container.getConnectionUri();
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret';
  process.env.JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL ?? '15m';

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: API_ROOT,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });

  // globalTeardown chạy cùng process nên lấy lại container qua globalThis.
  (globalThis as Record<string, unknown>).__PG_CONTAINER__ = container;
}
