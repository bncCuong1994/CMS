import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ROLES, type RoleCode } from '@cms/shared-types';
import * as argon2 from 'argon2';
import request from 'supertest';
import { seedRolesAndPermissions } from '../../src/modules/rbac/seed-roles';

export const TEST_PASSWORD = 'Password@123';

const DAY_MS = 86_400_000;
const INACTIVE_DAYS = 31;

/** Ba phòng ban ngang cấp của dữ liệu kiểm thử chuẩn. */
export const DEPARTMENTS = [
  { code: 'MARKETING', name: 'Marketing' },
  { code: 'AUDIO', name: 'Audio' },
  { code: 'VIDEO', name: 'Video Editor' },
] as const;

export type DepartmentCode = (typeof DEPARTMENTS)[number]['code'];

export type ActorKey =
  | 'superAdmin'
  | 'adminAudio'
  | 'adminAudioVideo'
  | 'userMarketing'
  | 'internVideo'
  | 'internInactive31d'
  | 'userInactive31d';

/** `anonymous` = không gửi Authorization header. */
export type ActorOrAnonymous = ActorKey | 'anonymous';

export interface SeededActor {
  id: string;
  email: string;
}

export interface World {
  departments: Record<DepartmentCode, string>;
  actors: Record<ActorKey, SeededActor>;
}

interface ActorSpec {
  key: ActorKey;
  email: string;
  fullName: string;
  role: RoleCode;
  /** Rỗng = gán vai trò ở phạm vi global (Super Admin). */
  departments: DepartmentCode[];
  inactive?: boolean;
}

const ACTOR_SPECS: ActorSpec[] = [
  { key: 'superAdmin', email: 'root@test.local', fullName: 'Super Admin', role: ROLES.SUPER_ADMIN, departments: [] },
  { key: 'adminAudio', email: 'admin.audio@test.local', fullName: 'Admin Audio', role: ROLES.ADMIN, departments: ['AUDIO'] },
  {
    key: 'adminAudioVideo',
    email: 'admin.audio.video@test.local',
    fullName: 'Admin Audio Video',
    role: ROLES.ADMIN,
    departments: ['AUDIO', 'VIDEO'],
  },
  {
    key: 'userMarketing',
    email: 'user.marketing@test.local',
    fullName: 'User Marketing',
    role: ROLES.USER,
    departments: ['MARKETING'],
  },
  { key: 'internVideo', email: 'intern.video@test.local', fullName: 'Intern Video', role: ROLES.INTERN, departments: ['VIDEO'] },
  {
    key: 'internInactive31d',
    email: 'intern.inactive@test.local',
    fullName: 'Intern Khong Hoat Dong',
    role: ROLES.INTERN,
    departments: ['VIDEO'],
    inactive: true,
  },
  {
    key: 'userInactive31d',
    email: 'user.inactive@test.local',
    fullName: 'User Khong Hoat Dong',
    role: ROLES.USER,
    departments: ['MARKETING'],
    inactive: true,
  },
];

/**
 * Dựng bộ dữ liệu kiểm thử chuẩn: vai trò + quyền, 3 phòng ban, 7 tài khoản.
 * Gọi sau khi đã `truncateAll`.
 */
export async function seedWorld(prisma: PrismaClient): Promise<World> {
  await seedRolesAndPermissions(prisma);

  const departments = {} as Record<DepartmentCode, string>;
  for (const def of DEPARTMENTS) {
    const row = await prisma.department.create({ data: { code: def.code, name: def.name } });
    departments[def.code] = row.id;
  }

  const roleIds = new Map((await prisma.role.findMany()).map((r) => [r.code, r.id] as const));
  const passwordHash = await argon2.hash(TEST_PASSWORD);
  const inactiveAt = new Date(Date.now() - INACTIVE_DAYS * DAY_MS);

  const actors = {} as Record<ActorKey, SeededActor>;
  for (const spec of ACTOR_SPECS) {
    const roleId = roleIds.get(spec.role)!;
    const departmentIds = spec.departments.map((code) => departments[code]);
    const user = await prisma.user.create({
      data: {
        email: spec.email,
        fullName: spec.fullName,
        passwordHash,
        lastActivityAt: spec.inactive ? inactiveAt : new Date(),
        departments: { create: departmentIds.map((departmentId) => ({ departmentId })) },
        roles: {
          create: departmentIds.length
            ? departmentIds.map((departmentId) => ({ roleId, scopeType: 'department' as const, scopeId: departmentId }))
            : [{ roleId, scopeType: 'global' as const, scopeId: null }],
        },
      },
      select: { id: true, email: true },
    });
    actors[spec.key] = user;
  }

  return { departments, actors };
}

export type TokenFor = (key: ActorOrAnonymous) => Promise<string | null>;

/**
 * Đăng nhập thật qua `POST /auth/login` (không tự ký JWT). Token được cache theo vai trò
 * để tránh chạy argon2 lại nhiều lần; vẫn là token do server cấp.
 */
export function createTokenFor(app: INestApplication, world: World): TokenFor {
  const cache = new Map<ActorKey, string>();
  return async (key) => {
    if (key === 'anonymous') return null;
    const cached = cache.get(key);
    if (cached) return cached;
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: world.actors[key].email, password: TEST_PASSWORD })
      .expect(200);
    const token = res.body.accessToken as string;
    cache.set(key, token);
    return token;
  };
}

/** Gắn bearer token nếu có; `null` nghĩa là gửi request không xác thực. */
export function withAuth(req: request.Test, token: string | null): request.Test {
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
}
