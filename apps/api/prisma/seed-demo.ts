import { PrismaClient, type Role, type Department } from '@prisma/client';
import * as argon2 from 'argon2';
import { ROLES } from '@cms/shared-types';
import { seedRolesAndPermissions } from '../src/modules/rbac/seed-roles';

/**
 * Seed dữ liệu DEMO cho DB local (idempotent, chạy lại không nhân đôi).
 * Tách khỏi seed.ts gốc. Mọi tài khoản dùng domain `demo.cms.local` để dễ lọc/xoá.
 *
 * Cách chạy: pnpm --filter api exec ts-node prisma/seed-demo.ts
 */

const prisma = new PrismaClient();

/** Mật khẩu chung cho mọi tài khoản demo (dữ liệu mẫu local, không phải secret thật). */
const DEMO_PASSWORD = 'Passw0rd@123';

/** Phòng ban mẫu, khớp với seed.ts gốc để script tự đủ. */
const SAMPLE_DEPARTMENTS = [
  { code: 'MARKETING', name: 'Marketing', description: 'Lên kế hoạch chiến dịch, viết content, chạy quảng cáo' },
  { code: 'AUDIO', name: 'Audio', description: 'Thu âm, mix, master' },
  { code: 'VIDEO', name: 'Video Editor', description: 'Dựng phim, color, xuất bản' },
];

type DeptCode = 'MARKETING' | 'AUDIO' | 'VIDEO';

/** Admin và danh sách phòng quản lý. admin1 quản lý 2 phòng (Marketing + Audio). */
const ADMIN_PLAN: { email: string; fullName: string; departments: DeptCode[] }[] = [
  { email: 'admin1@demo.cms.local', fullName: 'Admin Marketing+Audio', departments: ['MARKETING', 'AUDIO'] },
  { email: 'admin2@demo.cms.local', fullName: 'Admin Marketing', departments: ['MARKETING'] },
  { email: 'admin3@demo.cms.local', fullName: 'Admin Audio', departments: ['AUDIO'] },
  { email: 'admin4@demo.cms.local', fullName: 'Admin Video A', departments: ['VIDEO'] },
  { email: 'admin5@demo.cms.local', fullName: 'Admin Video B', departments: ['VIDEO'] },
];

/** 30 tài khoản USER/INTERN: ~24 USER + ~6 INTERN, chia đều 3 phòng. */
const DEPT_CYCLE: DeptCode[] = ['MARKETING', 'AUDIO', 'VIDEO'];
const INTERN_INDEXES = new Set([5, 10, 15, 20, 25, 30]); // 6 tài khoản là INTERN

/** Upsert user theo email; không ghi đè bản ghi sẵn có (update rỗng). */
async function upsertDemoUser(email: string, fullName: string, passwordHash: string, isIntern: boolean) {
  const recent = new Date(); // INTERN có hoạt động gần đây để không bị quy tắc tự khoá 30 ngày
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      fullName,
      passwordHash,
      status: 'active',
      position: isIntern ? 'Thực tập sinh' : 'Nhân viên',
      lastActivityAt: isIntern ? recent : null,
    },
  });
}

/** Gán UserRole theo phạm vi, chỉ tạo khi chưa có (dựa trên unique key). */
async function ensureUserRole(userId: string, roleId: string, scopeType: 'global' | 'department', scopeId: string | null) {
  const existing = await prisma.userRole.findFirst({ where: { userId, roleId, scopeType, scopeId } });
  if (!existing) {
    await prisma.userRole.create({ data: { userId, roleId, scopeType, scopeId } });
  }
}

/** Thêm vào DepartmentMember chỉ khi chưa có (composite id). */
async function ensureDepartmentMember(departmentId: string, userId: string) {
  const existing = await prisma.departmentMember.findUnique({
    where: { departmentId_userId: { departmentId, userId } },
  });
  if (!existing) {
    await prisma.departmentMember.create({ data: { departmentId, userId } });
  }
}

async function main() {
  // Tự đủ: tạo vai trò/quyền và 3 phòng ban mẫu nếu chưa có.
  await seedRolesAndPermissions(prisma);
  for (const d of SAMPLE_DEPARTMENTS) {
    await prisma.department.upsert({ where: { code: d.code }, update: {}, create: d });
  }

  const passwordHash = await argon2.hash(DEMO_PASSWORD);

  const roles: Record<string, Role> = {
    SUPER_ADMIN: await prisma.role.findUniqueOrThrow({ where: { code: ROLES.SUPER_ADMIN } }),
    ADMIN: await prisma.role.findUniqueOrThrow({ where: { code: ROLES.ADMIN } }),
    USER: await prisma.role.findUniqueOrThrow({ where: { code: ROLES.USER } }),
    INTERN: await prisma.role.findUniqueOrThrow({ where: { code: ROLES.INTERN } }),
  };

  const depts = new Map<DeptCode, Department>();
  for (const code of DEPT_CYCLE) {
    depts.set(code, await prisma.department.findUniqueOrThrow({ where: { code } }));
  }

  // 1 Super Admin (email khác admin@cms.local để không ghi đè seed gốc).
  const superAdmin = await upsertDemoUser('superadmin@cms.local', 'Super Admin (demo)', passwordHash, false);
  await ensureUserRole(superAdmin.id, roles.SUPER_ADMIN.id, 'global', null);

  // 5 Admin, gán phòng qua UserRole(department) + DepartmentMember.
  for (const plan of ADMIN_PLAN) {
    const user = await upsertDemoUser(plan.email, plan.fullName, passwordHash, false);
    for (const deptCode of plan.departments) {
      const dept = depts.get(deptCode)!;
      await ensureUserRole(user.id, roles.ADMIN.id, 'department', dept.id);
      await ensureDepartmentMember(dept.id, user.id);
    }
  }

  // 30 tài khoản USER/INTERN, chia đều 3 phòng.
  for (let i = 1; i <= 30; i++) {
    const isIntern = INTERN_INDEXES.has(i);
    const prefix = isIntern ? 'intern' : 'user';
    const num = String(i).padStart(2, '0');
    const email = `${prefix}${num}@demo.cms.local`;
    const fullName = isIntern ? `Intern ${num}` : `User ${num}`;
    const deptCode = DEPT_CYCLE[(i - 1) % DEPT_CYCLE.length];
    const dept = depts.get(deptCode)!;

    const user = await upsertDemoUser(email, fullName, passwordHash, isIntern);
    await ensureUserRole(user.id, isIntern ? roles.INTERN.id : roles.USER.id, 'department', dept.id);
    await ensureDepartmentMember(dept.id, user.id);
  }

  await printSummary();
}

async function printSummary() {
  const totalUsers = await prisma.user.count({ where: { deletedAt: null } });

  const roleCodes = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.USER, ROLES.INTERN];
  const roleCounts: Record<string, number> = {};
  for (const code of roleCodes) {
    roleCounts[code] = await prisma.userRole.count({ where: { role: { code } } });
  }

  const deptSummary: { code: string; members: number }[] = [];
  for (const code of DEPT_CYCLE) {
    const dept = await prisma.department.findUniqueOrThrow({ where: { code } });
    const members = await prisma.departmentMember.count({ where: { departmentId: dept.id } });
    deptSummary.push({ code, members });
  }

  console.log('\n===== TỔNG HỢP SEED DEMO =====');
  console.log(`Tổng user (deleted_at IS NULL): ${totalUsers}`);
  console.log('Số dòng user_roles theo vai trò:');
  for (const code of roleCodes) console.log(`  ${code}: ${roleCounts[code]}`);
  console.log('Số thành viên mỗi phòng (department_members):');
  for (const d of deptSummary) console.log(`  ${d.code}: ${d.members}`);

  // Danh sách Super Admin + 5 Admin kèm vai trò + phòng.
  console.log('\n----- Super Admin & Admin -----');
  const adminEmails = ['superadmin@cms.local', ...ADMIN_PLAN.map((a) => a.email)];
  const admins = await prisma.user.findMany({
    where: { email: { in: adminEmails } },
    include: { roles: { include: { role: true, department: true } } },
    orderBy: { email: 'asc' },
  });
  for (const u of admins) {
    const lines = u.roles.map((r) => {
      const scope = r.scopeType === 'global' ? 'global' : (r.department?.code ?? r.scopeId);
      return `${r.role.code}@${scope}`;
    });
    console.log(`  ${u.email} -> ${lines.join(', ')}`);
  }
  console.log('\nMật khẩu chung mọi tài khoản demo: ' + DEMO_PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
