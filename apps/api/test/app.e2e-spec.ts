import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { ROLES } from '@cms/shared-types';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/main';
import { seedRolesAndPermissions } from '../src/modules/rbac/seed-roles';

// Test xoá sạch dữ liệu, nên chỉ chạy trên database có chữ "test" trong tên.
if (!/test/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('DATABASE_URL phải trỏ tới database test (tên chứa "test")');
}

const PASSWORD = 'Password@123';
const prisma = new PrismaClient();
let app: INestApplication;
let deptA: string;
let deptB: string;

async function createUser(email: string, role: string, departmentId: string | null) {
  const roleRow = await prisma.role.findUniqueOrThrow({ where: { code: role } });
  return prisma.user.create({
    data: {
      email,
      fullName: email.split('@')[0],
      passwordHash: await argon2.hash(PASSWORD),
      ...(departmentId ? { departments: { create: { departmentId } } } : {}),
      roles: {
        create: { roleId: roleRow.id, scopeType: departmentId ? 'department' : 'global', scopeId: departmentId },
      },
    },
  });
}

async function login(email: string): Promise<string> {
  const res = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(200);
  return res.body.accessToken;
}

beforeAll(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE users, departments, department_members, roles, permissions, role_permissions, user_roles, refresh_tokens, audit_logs, activity_events CASCADE',
  );
  await seedRolesAndPermissions(prisma);
  deptA = (await prisma.department.create({ data: { code: 'AUDIO', name: 'Audio' } })).id;
  deptB = (await prisma.department.create({ data: { code: 'VIDEO', name: 'Video' } })).id;
  await createUser('root@test.local', ROLES.SUPER_ADMIN, null);
  await createUser('admin.a@test.local', ROLES.ADMIN, deptA);
  await createUser('user.b@test.local', ROLES.USER, deptB);
  await createUser('intern.a@test.local', ROLES.INTERN, deptA);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  // Lắng nghe sẵn để các request lồng nhau dùng chung một server.
  await app.listen(0);
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

describe('Xác thực', () => {
  it('đăng nhập đúng trả token và quyền', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin.a@test.local', password: PASSWORD })
      .expect(200);
    expect(res.body.user.roles).toEqual([{ role: 'ADMIN', departmentId: deptA, departmentName: 'Audio' }]);
    expect(res.body.user.grants.departments[deptA]).toContain('user.create');
    expect(await prisma.activityEvent.count({ where: { eventType: 'login' } })).toBeGreaterThan(0);
  });

  it('sai mật khẩu trả 401', () =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: 'admin.a@test.local', password: 'sai' }).expect(401));

  it('không có token trả 401', () => request(app.getHttpServer()).get('/api/v1/users').expect(401));

  it('refresh token xoay vòng, token cũ không dùng lại được', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'user.b@test.local', password: PASSWORD });
    await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken: body.refreshToken }).expect(200);
    await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken: body.refreshToken }).expect(401);
  });

  it('tài khoản bị khoá không đăng nhập được và token đang có mất hiệu lực', async () => {
    const token = await login('intern.a@test.local');
    await prisma.user.update({ where: { email: 'intern.a@test.local' }, data: { status: 'locked', lockedReason: 'manual' } });
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'intern.a@test.local', password: PASSWORD })
      .expect(401);
    await prisma.user.update({ where: { email: 'intern.a@test.local' }, data: { status: 'active', lockedReason: null } });
  });
});

describe('Phân quyền theo phòng ban', () => {
  it('Super Admin thấy mọi người dùng', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${await login('root@test.local')}`)
      .expect(200);
    expect(res.body).toHaveLength(4);
  });

  it('Admin chỉ thấy người dùng trong phòng mình', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${await login('admin.a@test.local')}`)
      .expect(200);
    expect(res.body.map((u: { email: string }) => u.email).sort()).toEqual(['admin.a@test.local', 'intern.a@test.local']);
  });

  it('Admin không xem được phòng không được gán', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/users?departmentId=${deptB}`)
      .set('Authorization', `Bearer ${await login('admin.a@test.local')}`)
      .expect(403);
  });

  it('Intern không xem được danh sách người dùng', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${await login('intern.a@test.local')}`)
      .expect(403);
  });

  it('Admin tạo được Intern trong phòng mình', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${await login('admin.a@test.local')}`)
      .send({ email: 'new.intern@test.local', fullName: 'Intern Mới', password: 'Password@123', departmentId: deptA, role: 'INTERN' })
      .expect(201);
    expect(await prisma.auditLog.count({ where: { action: 'user.create' } })).toBe(1);
  });

  it('Admin không tạo được người ở phòng khác', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${await login('admin.a@test.local')}`)
      .send({ email: 'x@test.local', fullName: 'User X', password: 'Password@123', departmentId: deptB, role: 'USER' })
      .expect(403);
  });

  it('Admin không tạo được tài khoản Admin khác', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${await login('admin.a@test.local')}`)
      .send({ email: 'y@test.local', fullName: 'Admin Y', password: 'Password@123', departmentId: deptA, role: 'ADMIN' })
      .expect(403);
  });

  it('chỉ Super Admin tạo được phòng ban', async () => {
    const body = { name: 'Marketing', code: 'MARKETING' };
    await request(app.getHttpServer())
      .post('/api/v1/departments')
      .set('Authorization', `Bearer ${await login('admin.a@test.local')}`)
      .send(body)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/departments')
      .set('Authorization', `Bearer ${await login('root@test.local')}`)
      .send(body)
      .expect(201);
  });

  it('User chỉ thấy phòng ban của mình', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/departments')
      .set('Authorization', `Bearer ${await login('user.b@test.local')}`)
      .expect(200);
    expect(res.body.map((d: { id: string }) => d.id)).toEqual([deptB]);
  });
});
