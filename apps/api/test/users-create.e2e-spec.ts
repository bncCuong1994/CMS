import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
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
import type { DepartmentRole } from '../src/modules/users/dto';

const NEW_PASSWORD = 'MatKhau@123';
const ENDPOINT = '/api/v1/users';

let app: INestApplication;
let prisma: PrismaClient;
let world: World;
let tokenFor: TokenFor;

let emailSeq = 0;
/** Email khác nhau cho mỗi ca để test không phụ thuộc thứ tự chạy. */
const uniqueEmail = () => `nhanvien.${(emailSeq += 1)}.${randomUUID().slice(0, 8)}@test.local`;

interface CreateUserBody {
  email: string;
  fullName: string;
  password: string;
  phone?: string;
  position?: string;
  departmentId: string;
  role: DepartmentRole;
}

function validBody(departmentId: string, role: DepartmentRole, overrides: Partial<CreateUserBody> = {}) {
  return {
    email: uniqueEmail(),
    fullName: 'Nguyễn Văn A',
    password: NEW_PASSWORD,
    phone: '0901234567',
    position: 'Chuyên viên',
    departmentId,
    role,
    ...overrides,
  };
}

/** Đếm mọi bảng mà luồng tạo người dùng ghi vào, để chứng minh "không tạo bản ghi nào". */
async function countWrites() {
  const [users, departmentMembers, userRoles, auditLogs] = await Promise.all([
    prisma.user.count(),
    prisma.departmentMember.count(),
    prisma.userRole.count(),
    prisma.auditLog.count(),
  ]);
  return { users, departmentMembers, userRoles, auditLogs };
}

function postUsers(token: string | null, body: object) {
  return withAuth(request(app.getHttpServer()).post(ENDPOINT), token).send(body);
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

describe('POST /api/v1/users — ma trận phân quyền', () => {
  // [người gọi, vai trò muốn tạo, phòng ban đích, HTTP mong đợi]
  const matrix: Array<[ActorOrAnonymous, DepartmentRole, DepartmentCode, number]> = [
    // Super Admin: mọi phòng, mọi vai trò.
    ['superAdmin', 'USER', 'AUDIO', 201],
    ['superAdmin', 'USER', 'MARKETING', 201],
    ['superAdmin', 'INTERN', 'VIDEO', 201],
    ['superAdmin', 'ADMIN', 'MARKETING', 201],
    // Admin chỉ ở phòng được gán.
    ['adminAudio', 'USER', 'AUDIO', 201],
    ['adminAudio', 'INTERN', 'AUDIO', 201],
    ['adminAudio', 'USER', 'MARKETING', 403],
    ['adminAudio', 'USER', 'VIDEO', 403],
    ['adminAudio', 'ADMIN', 'AUDIO', 403],
    // Admin nhiều phòng: được ở cả hai, vẫn bị chặn ở phòng thứ ba.
    ['adminAudioVideo', 'USER', 'AUDIO', 201],
    ['adminAudioVideo', 'USER', 'VIDEO', 201],
    ['adminAudioVideo', 'USER', 'MARKETING', 403],
    ['adminAudioVideo', 'ADMIN', 'VIDEO', 403],
    // User: không có user.create ở bất kỳ phòng nào.
    ['userMarketing', 'USER', 'MARKETING', 403],
    ['userMarketing', 'USER', 'AUDIO', 403],
    ['userMarketing', 'ADMIN', 'MARKETING', 403],
    // Intern: không có user.create.
    ['internVideo', 'USER', 'VIDEO', 403],
    ['internVideo', 'INTERN', 'VIDEO', 403],
    ['internVideo', 'ADMIN', 'VIDEO', 403],
    // Chưa đăng nhập.
    ['anonymous', 'USER', 'AUDIO', 401],
    ['anonymous', 'ADMIN', 'AUDIO', 401],
  ];

  it.each(matrix)('%s tạo vai trò %s ở phòng %s → %i', async (actor, role, departmentCode, expected) => {
    const before = await countWrites();
    const body = validBody(world.departments[departmentCode], role);

    await postUsers(await tokenFor(actor), body).expect(expected);

    if (expected === 201) {
      expect(await prisma.user.findUnique({ where: { email: body.email } })).not.toBeNull();
      return;
    }
    // Ca bị chặn: không được tạo bản ghi nào ở bất kỳ bảng nào.
    expect(await prisma.user.findUnique({ where: { email: body.email } })).toBeNull();
    expect(await countWrites()).toEqual(before);
  });
});

describe('POST /api/v1/users — ca phân quyền bắt buộc theo story', () => {
  it('Admin phòng Audio gửi departmentId của Marketing → 403 và không tạo bản ghi nào', async () => {
    const before = await countWrites();
    const body = validBody(world.departments.MARKETING, 'USER');

    const res = await postUsers(await tokenFor('adminAudio'), body).expect(403);

    expect(res.body.message).toMatch(/Không có quyền/);
    expect(await prisma.user.findUnique({ where: { email: body.email } })).toBeNull();
    expect(await countWrites()).toEqual(before);
  });

  it('Admin tạo vai trò ADMIN → 403 "Chỉ Super Admin được tạo tài khoản Admin"', async () => {
    const before = await countWrites();
    const body = validBody(world.departments.AUDIO, 'ADMIN');

    const res = await postUsers(await tokenFor('adminAudio'), body).expect(403);

    expect(res.body.message).toBe('Chỉ Super Admin được tạo tài khoản Admin');
    expect(await prisma.user.findUnique({ where: { email: body.email } })).toBeNull();
    expect(await countWrites()).toEqual(before);
  });

  it('User có access token hợp lệ → 403 chứ không phải 401', async () => {
    const token = await tokenFor('userMarketing');
    // Token thật sự hợp lệ: gọi được endpoint mà User có quyền.
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);

    const res = await postUsers(token, validBody(world.departments.MARKETING, 'USER'));

    expect(res.status).toBe(403);
    expect(res.status).not.toBe(401);
  });

  it('Intern có access token hợp lệ → 403 chứ không phải 401', async () => {
    const token = await tokenFor('internVideo');
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);

    const res = await postUsers(token, validBody(world.departments.VIDEO, 'USER'));

    expect(res.status).toBe(403);
    expect(res.status).not.toBe(401);
  });

  it('không có token → 401', () => postUsers(null, validBody(world.departments.AUDIO, 'USER')).expect(401));

  it('token sai định dạng / chữ ký sai → 401', async () => {
    await postUsers('khong-phai-jwt', validBody(world.departments.AUDIO, 'USER')).expect(401);
    const [h, p] = (await tokenFor('superAdmin'))!.split('.');
    await postUsers(`${h}.${p}.chu-ky-sai`, validBody(world.departments.AUDIO, 'USER')).expect(401);
  });
});

describe('POST /api/v1/users — ca nghiệp vụ', () => {
  it('email trùng → 409 "Email đã được sử dụng"', async () => {
    const before = await countWrites();
    const body = validBody(world.departments.AUDIO, 'USER', { email: world.actors.adminAudio.email });

    const res = await postUsers(await tokenFor('superAdmin'), body).expect(409);

    expect(res.body.message).toBe('Email đã được sử dụng');
    expect(await countWrites()).toEqual(before);
  });

  it('email trùng nhưng khác hoa/thường → 409 (email lưu lowercase)', async () => {
    const body = validBody(world.departments.AUDIO, 'USER', { email: world.actors.adminAudio.email.toUpperCase() });

    await postUsers(await tokenFor('superAdmin'), body).expect(409);
  });

  it('departmentId không tồn tại → 404 "Không tìm thấy phòng ban"', async () => {
    const before = await countWrites();

    const res = await postUsers(await tokenFor('superAdmin'), validBody(randomUUID(), 'USER')).expect(404);

    expect(res.body.message).toBe('Không tìm thấy phòng ban');
    expect(await countWrites()).toEqual(before);
  });

  it('departmentId đã xoá mềm → 404', async () => {
    const deleted = await prisma.department.create({
      data: { code: `DELETED-${randomUUID().slice(0, 8)}`, name: 'Phòng đã xoá', deletedAt: new Date() },
    });

    const res = await postUsers(await tokenFor('superAdmin'), validBody(deleted.id, 'USER')).expect(404);

    expect(res.body.message).toBe('Không tìm thấy phòng ban');
  });

  const invalidBodies: Array<[string, Partial<CreateUserBody>, string]> = [
    ['email sai định dạng', { email: 'khong-phai-email' }, 'email'],
    ['password dưới 8 ký tự', { password: 'abc1234' }, 'password'],
    ['thiếu fullName', { fullName: undefined }, 'fullName'],
    ['fullName dưới 2 ký tự', { fullName: 'A' }, 'fullName'],
    ['role ngoài danh sách', { role: 'SUPER_ADMIN' as DepartmentRole }, 'role'],
    ['departmentId không phải uuid', { departmentId: 'abc' }, 'departmentId'],
  ];

  // Dùng Super Admin vì guard chạy trước ValidationPipe: Admin sẽ bị 403 trước khi tới validate.
  it.each(invalidBodies)('validate DTO: %s → 400', async (_label, overrides, field) => {
    const before = await countWrites();
    const body = { ...validBody(world.departments.AUDIO, 'USER'), ...overrides };
    if (overrides.fullName === undefined && 'fullName' in overrides) delete (body as Record<string, unknown>).fullName;

    const res = await postUsers(await tokenFor('superAdmin'), body).expect(400);

    expect(JSON.stringify(res.body.message)).toContain(field);
    expect(await countWrites()).toEqual(before);
  });

  it('trường lạ trong body → 400 (whitelist)', async () => {
    const body = { ...validBody(world.departments.AUDIO, 'USER'), status: 'locked' };

    await postUsers(await tokenFor('superAdmin'), body).expect(400);
  });
});

describe('POST /api/v1/users — tạo thành công ghi đúng dữ liệu', () => {
  it('Super Admin tạo User: users, department_members, user_roles, audit_logs đúng', async () => {
    const departmentId = world.departments.VIDEO;
    const body = validBody(departmentId, 'USER', { phone: '0912345678', position: 'Biên tập viên' });

    const res = await postUsers(await tokenFor('superAdmin'), body).expect(201);

    expect(res.body).toEqual({
      id: expect.any(String),
      email: body.email,
      fullName: body.fullName,
      status: 'active',
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: res.body.id },
      include: { departments: true, roles: { include: { role: true } } },
    });
    expect(user.phone).toBe('0912345678');
    expect(user.position).toBe('Biên tập viên');
    expect(user.status).toBe('active');
    expect(user.deletedAt).toBeNull();

    expect(user.departments.map((d) => d.departmentId)).toEqual([departmentId]);

    expect(user.roles).toHaveLength(1);
    expect(user.roles[0].role.code).toBe('USER');
    expect(user.roles[0].scopeType).toBe('department');
    expect(user.roles[0].scopeId).toBe(departmentId);
    expect(user.roles[0].grantedBy).toBe(world.actors.superAdmin.id);

    const audits = await prisma.auditLog.findMany({ where: { action: 'user.create', entityId: res.body.id } });
    expect(audits).toHaveLength(1);
    expect(audits[0].actorId).toBe(world.actors.superAdmin.id);
    expect(audits[0].entityType).toBe('user');
    expect(audits[0].after).toMatchObject({ email: body.email, role: 'USER', departmentId });
  });

  it('Admin tạo Intern trong phòng mình: scope_id là phòng của Admin, actor_id là Admin', async () => {
    const departmentId = world.departments.AUDIO;
    const body = validBody(departmentId, 'INTERN');

    const res = await postUsers(await tokenFor('adminAudio'), body).expect(201);

    const roles = await prisma.userRole.findMany({ where: { userId: res.body.id }, include: { role: true } });
    expect(roles).toHaveLength(1);
    expect(roles[0]).toMatchObject({ scopeType: 'department', scopeId: departmentId, grantedBy: world.actors.adminAudio.id });
    expect(roles[0].role.code).toBe('INTERN');

    const audits = await prisma.auditLog.findMany({ where: { action: 'user.create', entityId: res.body.id } });
    expect(audits).toHaveLength(1);
    expect(audits[0].actorId).toBe(world.actors.adminAudio.id);
  });

  it('email lưu lowercase', async () => {
    const email = uniqueEmail().toUpperCase();
    const res = await postUsers(await tokenFor('superAdmin'), validBody(world.departments.AUDIO, 'USER', { email })).expect(201);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(user.email).toBe(email.toLowerCase());
  });

  it('mật khẩu không lưu plaintext và không xuất hiện trong response', async () => {
    const body = validBody(world.departments.AUDIO, 'USER');

    const res = await postUsers(await tokenFor('superAdmin'), body).expect(201);

    expect(JSON.stringify(res.body)).not.toContain(NEW_PASSWORD);
    expect(res.body).not.toHaveProperty('password');
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body).not.toHaveProperty('phone');

    const user = await prisma.user.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(user.passwordHash).not.toContain(NEW_PASSWORD);
    expect(user.passwordHash.startsWith('$argon2')).toBe(true);
    expect(await argon2.verify(user.passwordHash, NEW_PASSWORD)).toBe(true);

    // Không có cột nào trong users còn giữ plaintext.
    const rows = await prisma.$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM users WHERE id = $1::uuid AND (users::text LIKE '%' || $2 || '%')`,
      user.id,
      NEW_PASSWORD,
    );
    expect(rows).toHaveLength(0);
  });

  it('người dùng vừa tạo đăng nhập được bằng mật khẩu đã đặt', async () => {
    const body = validBody(world.departments.AUDIO, 'USER');
    await postUsers(await tokenFor('superAdmin'), body).expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: body.email, password: NEW_PASSWORD })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: body.email, password: TEST_PASSWORD })
      .expect(401);
  });
});
