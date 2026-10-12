import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import {
  type ActorOrAnonymous,
  type DepartmentCode,
  type TokenFor,
  type World,
  TEST_PASSWORD,
  createTokenFor,
  seedWorld,
  withAuth,
} from './fixtures/actors';
import { createPrismaClient, createTestApp, truncateAll } from './helpers/test-app';

const ENDPOINT = '/api/v1/users';
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

let app: INestApplication;
let prisma: PrismaClient;
let world: World;
let tokenFor: TokenFor;

let emailSeq = 0;
const uniqueEmail = (prefix = 'target') => `${prefix}.${(emailSeq += 1)}.${randomUUID().slice(0, 8)}@test.local`;

type RoleCode = 'ADMIN' | 'USER' | 'INTERN' | 'SUPER_ADMIN';

/**
 * Tạo một người dùng đích (để bị sửa) thật trong DB với tập phòng + vai trò theo phạm vi.
 * Trả về id + email + password để có thể đăng nhập (lấy refresh token).
 */
async function seedTarget(opts: {
  departmentCodes: DepartmentCode[];
  roleCode: RoleCode;
  fullName?: string;
  phone?: string | null;
  position?: string | null;
}): Promise<{ id: string; email: string; password: string }> {
  const role = await prisma.role.findUniqueOrThrow({ where: { code: opts.roleCode } });
  const email = uniqueEmail().toLowerCase();
  const password = TEST_PASSWORD;
  const departmentIds = opts.departmentCodes.map((code) => world.departments[code]);
  const user = await prisma.user.create({
    data: {
      email,
      fullName: opts.fullName ?? 'Nguoi Dung Dich',
      phone: opts.phone ?? null,
      position: opts.position ?? null,
      passwordHash: await argon2.hash(password),
      status: 'active',
      lastActivityAt: new Date(),
      departments: { create: departmentIds.map((departmentId) => ({ departmentId })) },
      roles: {
        create: departmentIds.map((departmentId) => ({
          roleId: role.id,
          scopeType: 'department' as const,
          scopeId: departmentId,
        })),
      },
    },
    select: { id: true },
  });
  return { id: user.id, email, password };
}

function patchUser(token: string | null, id: string, body: object) {
  return withAuth(request(app.getHttpServer()).patch(`${ENDPOINT}/${id}`), token).send(body);
}

/** Ảnh chụp mọi bảng mà luồng sửa chạm vào, để chứng minh "không thay đổi bản ghi nào". */
async function snapshot(userId: string) {
  const [user, departmentMembers, userRoles] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.departmentMember.findMany({ where: { userId }, orderBy: { departmentId: 'asc' } }),
    prisma.userRole.findMany({ where: { userId }, orderBy: [{ scopeId: 'asc' }, { roleId: 'asc' }] }),
  ]);
  return {
    fullName: user.fullName,
    phone: user.phone,
    position: user.position,
    departmentIds: departmentMembers.map((d) => d.departmentId).sort(),
    roleIds: userRoles.map((r) => `${r.roleId}:${r.scopeId}`).sort(),
  };
}

async function departmentIdsOf(userId: string): Promise<string[]> {
  const rows = await prisma.departmentMember.findMany({ where: { userId }, select: { departmentId: true } });
  return rows.map((r) => r.departmentId).sort();
}

async function roleCodesByDept(userId: string): Promise<Record<string, string[]>> {
  const rows = await prisma.userRole.findMany({
    where: { userId, scopeType: 'department' },
    include: { role: true },
  });
  const out: Record<string, string[]> = {};
  for (const r of rows) {
    const key = r.scopeId ?? 'null';
    (out[key] ??= []).push(r.role.code);
  }
  return out;
}

beforeAll(async () => {
  prisma = createPrismaClient();
  await truncateAll(prisma);
  world = await seedWorld(prisma);
  app = await createTestApp();
  tokenFor = createTokenFor(app, world);
});

afterAll(async () => {
  await app?.close();
  await prisma?.$disconnect();
});

// ── Ma trận phân quyền (AC2 / Ca phân quyền) ─────────────────────────────────
describe('PATCH /api/v1/users/:id — ma trận phân quyền', () => {
  // [người gọi, phòng của người bị sửa, vai trò người bị sửa, HTTP mong đợi]
  const matrix: Array<[ActorOrAnonymous, DepartmentCode, RoleCode, number]> = [
    // Super Admin: mọi phòng, mọi vai trò bị sửa (USER/INTERN).
    ['superAdmin', 'AUDIO', 'USER', 200],
    ['superAdmin', 'MARKETING', 'USER', 200],
    ['superAdmin', 'VIDEO', 'INTERN', 200],
    // Admin Audio: sửa USER/INTERN trong phòng mình ✅; ngoài phòng → 403.
    ['adminAudio', 'AUDIO', 'USER', 200],
    ['adminAudio', 'AUDIO', 'INTERN', 200],
    ['adminAudio', 'MARKETING', 'USER', 403],
    ['adminAudio', 'VIDEO', 'INTERN', 403],
    // Admin nhiều phòng: ở cả Audio và Video; vẫn bị chặn ở Marketing.
    ['adminAudioVideo', 'AUDIO', 'USER', 200],
    ['adminAudioVideo', 'VIDEO', 'INTERN', 200],
    ['adminAudioVideo', 'MARKETING', 'USER', 403],
    // User: không có user.update → 403 (token hợp lệ, không phải 401).
    ['userMarketing', 'MARKETING', 'USER', 403],
    ['userMarketing', 'AUDIO', 'USER', 403],
    // Intern: không có user.update → 403.
    ['internVideo', 'VIDEO', 'INTERN', 403],
    ['internVideo', 'AUDIO', 'USER', 403],
    // Chưa đăng nhập → 401.
    ['anonymous', 'AUDIO', 'USER', 401],
  ];

  it.each(matrix)('%s sửa người %s (%s) → %i', async (actor, deptCode, roleCode, expected) => {
    const target = await seedTarget({ departmentCodes: [deptCode], roleCode, fullName: 'Ten Cu' });
    const before = await snapshot(target.id);

    await patchUser(await tokenFor(actor), target.id, { fullName: 'Ten Moi' }).expect(expected);

    if (expected === 200) {
      expect((await snapshot(target.id)).fullName).toBe('Ten Moi');
      return;
    }
    // Ca bị chặn: bản ghi không đổi.
    expect(await snapshot(target.id)).toEqual(before);
  });
});

// ── Ca phân quyền bắt buộc theo story ────────────────────────────────────────
describe('PATCH /api/v1/users/:id — ca phân quyền bắt buộc', () => {
  it('AC7: Admin Audio PATCH người chỉ thuộc Marketing → 403 và không thay đổi bản ghi nào', async () => {
    const target = await seedTarget({ departmentCodes: ['MARKETING'], roleCode: 'USER', fullName: 'Marketing User' });
    const before = await snapshot(target.id);

    const res = await patchUser(await tokenFor('adminAudio'), target.id, {
      fullName: 'Da Bi Sua',
      phone: '0999999999',
    }).expect(403);

    expect(res.body.message).toMatch(/Không có quyền/);
    expect(await snapshot(target.id)).toEqual(before);
  });

  it('AC6: Admin đặt role=ADMIN → 403 "Chỉ Super Admin được gán vai trò Admin"', async () => {
    const target = await seedTarget({ departmentCodes: ['AUDIO'], roleCode: 'USER' });
    const before = await snapshot(target.id);

    const res = await patchUser(await tokenFor('adminAudio'), target.id, { role: 'ADMIN' }).expect(403);

    expect(res.body.message).toBe('Chỉ Super Admin được gán vai trò Admin');
    expect(await snapshot(target.id)).toEqual(before);
  });

  it('Ca phân quyền: Admin không được sửa một ADMIN → 403', async () => {
    const target = await seedTarget({ departmentCodes: ['AUDIO'], roleCode: 'ADMIN' });
    const before = await snapshot(target.id);

    const res = await patchUser(await tokenFor('adminAudio'), target.id, { fullName: 'Doi Ten Admin' }).expect(403);

    expect(res.body.message).toBe('Chỉ Super Admin được gán vai trò Admin');
    expect(await snapshot(target.id)).toEqual(before);
  });

  it('AC8: Admin Audio gửi departmentIds chứa phòng Video → 403, phòng ngoài phạm vi giữ nguyên', async () => {
    // Người bị sửa thuộc Audio (trong phạm vi) + Marketing (ngoài phạm vi).
    const target = await seedTarget({ departmentCodes: ['AUDIO', 'MARKETING'], roleCode: 'USER' });
    const before = await snapshot(target.id);

    const res = await patchUser(await tokenFor('adminAudio'), target.id, {
      departmentIds: [world.departments.AUDIO, world.departments.VIDEO],
    }).expect(403);

    expect(res.body.message).toMatch(/Không có quyền gán phòng ban này/);
    // Không thay đổi bản ghi nào: Marketing (ngoài phạm vi) vẫn còn.
    expect(await snapshot(target.id)).toEqual(before);
  });

  it('User có access token hợp lệ → 403 chứ không phải 401', async () => {
    const target = await seedTarget({ departmentCodes: ['MARKETING'], roleCode: 'USER' });
    const token = await tokenFor('userMarketing');
    // Token thật hợp lệ: gọi được endpoint mà User có quyền.
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);

    const res = await patchUser(token, target.id, { fullName: 'Thu Sua' });

    expect(res.status).toBe(403);
    expect(res.status).not.toBe(401);
  });

  it('Intern có access token hợp lệ → 403 chứ không phải 401', async () => {
    const target = await seedTarget({ departmentCodes: ['VIDEO'], roleCode: 'INTERN' });
    const token = await tokenFor('internVideo');
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);

    const res = await patchUser(token, target.id, { fullName: 'Thu Sua' });

    expect(res.status).toBe(403);
    expect(res.status).not.toBe(401);
  });

  it('không có token → 401', async () => {
    const target = await seedTarget({ departmentCodes: ['AUDIO'], roleCode: 'USER' });
    await patchUser(null, target.id, { fullName: 'Thu Sua' }).expect(401);
  });
});

// ── Thuật toán gán phòng (phần dễ sai nhất) ──────────────────────────────────
describe('PATCH /api/v1/users/:id — thuật toán gán phòng', () => {
  it('Admin sửa người có cả phòng trong + ngoài phạm vi: giữ phòng ngoài, ghi đè phần trong phạm vi', async () => {
    // D_target = {Audio, Marketing}; D_admin = {Audio}. Gửi D_req = {} (gỡ khỏi Audio).
    // Kỳ vọng: (D_target \ D_admin) ∪ D_req = {Marketing}.
    const target = await seedTarget({ departmentCodes: ['AUDIO', 'MARKETING'], roleCode: 'USER' });

    await patchUser(await tokenFor('adminAudio'), target.id, { departmentIds: [] }).expect(200);

    expect(await departmentIdsOf(target.id)).toEqual([world.departments.MARKETING]);
  });

  it('Admin nhiều phòng ghi đè phần trong phạm vi, giữ phòng ngoài phạm vi', async () => {
    // D_target = {Audio, Video, Marketing}; D_admin = {Audio, Video}. D_req = {Video}.
    // Kỳ vọng: giữ Marketing (ngoài), bỏ Audio, giữ Video → {Marketing, Video}.
    const target = await seedTarget({ departmentCodes: ['AUDIO', 'VIDEO', 'MARKETING'], roleCode: 'USER' });

    await patchUser(await tokenFor('adminAudioVideo'), target.id, {
      departmentIds: [world.departments.VIDEO],
    }).expect(200);

    expect(await departmentIdsOf(target.id)).toEqual(
      [world.departments.MARKETING, world.departments.VIDEO].sort(),
    );
  });

  it('Super Admin thay toàn bộ tập phòng (AC4)', async () => {
    const target = await seedTarget({ departmentCodes: ['MARKETING'], roleCode: 'USER' });

    await patchUser(await tokenFor('superAdmin'), target.id, {
      departmentIds: [world.departments.AUDIO, world.departments.VIDEO],
    }).expect(200);

    expect(await departmentIdsOf(target.id)).toEqual(
      [world.departments.AUDIO, world.departments.VIDEO].sort(),
    );
    // user_roles theo phạm vi đồng bộ với tập phòng mới.
    const byDept = await roleCodesByDept(target.id);
    expect(Object.keys(byDept).sort()).toEqual([world.departments.AUDIO, world.departments.VIDEO].sort());
    expect(byDept[world.departments.AUDIO]).toEqual(['USER']);
    expect(byDept[world.departments.VIDEO]).toEqual(['USER']);
  });
});

// ── Đổi vai trò → thu hồi refresh token + giữ lịch sử (AC5) ──────────────────
describe('PATCH /api/v1/users/:id — đổi vai trò thu hồi phiên', () => {
  it('AC5: INTERN → USER đặt refresh_tokens.revoked_at và refresh token cũ bị từ chối', async () => {
    const target = await seedTarget({ departmentCodes: ['VIDEO'], roleCode: 'INTERN' });

    // Người bị sửa đăng nhập để có refresh token thật.
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: target.email, password: target.password })
      .expect(200);
    const oldRefresh = login.body.refreshToken as string;
    expect(oldRefresh).toBeTruthy();

    // Trước khi đổi: refresh token còn hiệu lực.
    const tokenRow = await prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash: sha256(oldRefresh) } });
    expect(tokenRow.revokedAt).toBeNull();

    await patchUser(await tokenFor('superAdmin'), target.id, { role: 'USER' }).expect(200);

    // revoked_at được set.
    const afterRow = await prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash: sha256(oldRefresh) } });
    expect(afterRow.revokedAt).not.toBeNull();

    // refresh token cũ gọi lại bị từ chối (buộc đăng nhập lại).
    await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken: oldRefresh }).expect(401);

    // Vai trò theo phòng đã đổi thành USER.
    const byDept = await roleCodesByDept(target.id);
    expect(byDept[world.departments.VIDEO]).toEqual(['USER']);
  });

  it('AC5: đổi vai trò giữ nguyên lịch sử (activity_events của người đó không bị xoá)', async () => {
    const target = await seedTarget({ departmentCodes: ['VIDEO'], roleCode: 'INTERN' });

    // Đăng nhập tạo activity_events 'login' — đóng vai lịch sử hoạt động của người đó.
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: target.email, password: target.password })
      .expect(200);
    const historyBefore = await prisma.activityEvent.count({ where: { userId: target.id } });
    expect(historyBefore).toBeGreaterThan(0);

    await patchUser(await tokenFor('superAdmin'), target.id, { role: 'USER' }).expect(200);

    const historyAfter = await prisma.activityEvent.count({ where: { userId: target.id } });
    expect(historyAfter).toBe(historyBefore);
  });

  it('chỉ đổi thông tin cơ bản (không đổi vai trò/phòng) KHÔNG thu hồi refresh token', async () => {
    const target = await seedTarget({ departmentCodes: ['AUDIO'], roleCode: 'USER' });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: target.email, password: target.password })
      .expect(200);
    const refresh = login.body.refreshToken as string;

    await patchUser(await tokenFor('superAdmin'), target.id, { fullName: 'Chi Doi Ten' }).expect(200);

    const row = await prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash: sha256(refresh) } });
    expect(row.revokedAt).toBeNull();
  });
});

// ── Audit log (AC3) ──────────────────────────────────────────────────────────
describe('PATCH /api/v1/users/:id — ghi audit_logs', () => {
  it('AC3: audit_logs có dòng action=user.update với before/after chứa trường đã đổi', async () => {
    const target = await seedTarget({
      departmentCodes: ['AUDIO'],
      roleCode: 'USER',
      fullName: 'Ho Ten Cu',
      phone: '0900000000',
      position: 'Chuc Danh Cu',
    });

    await patchUser(await tokenFor('superAdmin'), target.id, {
      fullName: 'Ho Ten Moi',
      position: 'Chuc Danh Moi',
    }).expect(200);

    const audits = await prisma.auditLog.findMany({ where: { action: 'user.update', entityId: target.id } });
    expect(audits).toHaveLength(1);
    expect(audits[0].actorId).toBe(world.actors.superAdmin.id);
    expect(audits[0].entityType).toBe('user');
    expect(audits[0].before).toMatchObject({ fullName: 'Ho Ten Cu', position: 'Chuc Danh Cu' });
    expect(audits[0].after).toMatchObject({ fullName: 'Ho Ten Moi', position: 'Chuc Danh Moi' });
  });
});

// ── Validate / Not found ─────────────────────────────────────────────────────
describe('PATCH /api/v1/users/:id — validate & not found', () => {
  it('fullName < 2 ký tự → 400, không thay đổi bản ghi', async () => {
    const target = await seedTarget({ departmentCodes: ['AUDIO'], roleCode: 'USER', fullName: 'Giu Nguyen' });
    const before = await snapshot(target.id);

    const res = await patchUser(await tokenFor('superAdmin'), target.id, { fullName: 'A' }).expect(400);

    expect(JSON.stringify(res.body.message)).toContain('fullName');
    expect(await snapshot(target.id)).toEqual(before);
  });

  it('trường lạ trong body → 400 (whitelist)', async () => {
    const target = await seedTarget({ departmentCodes: ['AUDIO'], roleCode: 'USER' });

    await patchUser(await tokenFor('superAdmin'), target.id, { email: 'doi@email.local' }).expect(400);
  });

  it('role=SUPER_ADMIN trong body → 400', async () => {
    const target = await seedTarget({ departmentCodes: ['AUDIO'], roleCode: 'USER' });

    await patchUser(await tokenFor('superAdmin'), target.id, { role: 'SUPER_ADMIN' }).expect(400);
  });

  it('user không tồn tại → 404 "Không tìm thấy người dùng"', async () => {
    const res = await patchUser(await tokenFor('superAdmin'), randomUUID(), { fullName: 'Ten Moi' }).expect(404);

    expect(res.body.message).toBe('Không tìm thấy người dùng');
  });

  it('user đã xoá mềm → 404', async () => {
    const target = await seedTarget({ departmentCodes: ['AUDIO'], roleCode: 'USER' });
    await prisma.user.update({ where: { id: target.id }, data: { deletedAt: new Date() } });

    const res = await patchUser(await tokenFor('superAdmin'), target.id, { fullName: 'Ten Moi' }).expect(404);

    expect(res.body.message).toBe('Không tìm thấy người dùng');
  });

  it('departmentIds chứa phòng không tồn tại → 404 "Không tìm thấy phòng ban" (Super Admin)', async () => {
    const target = await seedTarget({ departmentCodes: ['AUDIO'], roleCode: 'USER' });
    const before = await snapshot(target.id);

    const res = await patchUser(await tokenFor('superAdmin'), target.id, {
      departmentIds: [world.departments.AUDIO, randomUUID()],
    }).expect(404);

    expect(res.body.message).toBe('Không tìm thấy phòng ban');
    expect(await snapshot(target.id)).toEqual(before);
  });
});
