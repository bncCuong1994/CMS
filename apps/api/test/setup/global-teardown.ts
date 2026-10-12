import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

export default async function globalTeardown(): Promise<void> {
  const container = (globalThis as Record<string, unknown>).__PG_CONTAINER__ as
    | StartedPostgreSqlContainer
    | undefined;
  // Nếu không lấy lại được container thì Ryuk của Testcontainers vẫn dọn khi process kết thúc.
  await container?.stop();
}
