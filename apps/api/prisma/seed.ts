import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { ROLES } from '@cms/shared-types';
import { seedRolesAndPermissions } from '../src/modules/rbac/seed-roles';

const prisma = new PrismaClient();

/** Phòng ban mẫu, Super Admin có thể sửa/xoá trên giao diện. */
const SAMPLE_DEPARTMENTS = [
  { code: 'MARKETING', name: 'Marketing', description: 'Lên kế hoạch chiến dịch, viết content, chạy quảng cáo' },
  { code: 'AUDIO', name: 'Audio', description: 'Thu âm, mix, master' },
  { code: 'VIDEO', name: 'Video Editor', description: 'Dựng phim, color, xuất bản' },
];

async function main() {
  await seedRolesAndPermissions(prisma);

  for (const d of SAMPLE_DEPARTMENTS) {
    await prisma.department.upsert({ where: { code: d.code }, update: {}, create: d });
  }

  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@cms.local';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';
  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, fullName: 'Super Admin', passwordHash: await argon2.hash(password) },
  });
  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { code: ROLES.SUPER_ADMIN } });
  const existing = await prisma.userRole.findFirst({
    where: { userId: admin.id, roleId: superAdminRole.id, scopeType: 'global' },
  });
  if (!existing) {
    await prisma.userRole.create({
      data: { userId: admin.id, roleId: superAdminRole.id, scopeType: 'global' },
    });
  }

  console.log(`Seed xong. Super Admin: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
