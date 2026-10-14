import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import {
  type ActorOrAnonymous,
  type TokenFor,
  type World,
  createTokenFor,
  seedWorld,
  withAuth,
} from './fixtures/actors';
import { createPrismaClient, createTestApp, truncateAll } from './helpers/test-app';

const SETTINGS = '/api/v1/attendance/settings';
const LOCATIONS = '/api/v1/attendance/office-locations';

let app: INestApplication;
let prisma: PrismaClient;
let world: World;
let tokenFor: TokenFor;

function get(path: string, token: string | null) {
  return withAuth(request(app.getHttpServer()).get(path), token);
}
function patch(path: string, token: string | null, body: object) {
  return withAuth(request(app.getHttpServer()).patch(path), token).send(body);
}
function post(path: string, token: string | null, body: object) {
  return withAuth(request(app.getHttpServer()).post(path), token).send(body);
}
function del(path: string, token: string | null) {
  return withAuth(request(app.getHttpServer()).delete(path), token);
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

describe('GET /attendance/settings — mặc định khi chưa cấu hình', () => {
  it('Super Admin đọc khi DB rỗng → bộ mặc định + officeLocations rỗng', async () => {
    const res = await get(SETTINGS, await tokenFor('superAdmin')).expect(200);
    expect(res.body).toEqual({
      workStart: '08:00',
      workEnd: '17:00',
      lunchStart: '12:00',
      lunchEnd: '13:00',
      workDays: [1, 2, 3, 4, 5],
      monthlyLateAllowanceMin: 60,
      timezone: 'Asia/Ho_Chi_Minh',
      officeLocations: [],
    });
  });
});

describe('Phân quyền GET — đọc cần attendance.config_read (US-ATT-03 AC7, decisions.md 2026-10-14)', () => {
  // Admin (một hoặc nhiều phòng) và User có attendance.config_read → GET 200.
  // Quyền đọc là global (singleton toàn công ty), không phụ thuộc/không lọc theo phòng.
  const canRead: ActorOrAnonymous[] = ['adminAudio', 'adminAudioVideo', 'userMarketing'];

  it.each(canRead)('%s GET /attendance/settings → 200', async (actor) => {
    const res = await get(SETTINGS, await tokenFor(actor)).expect(200);
    // Đọc được cùng một bản ghi singleton (có đủ trường lịch + danh sách điểm).
    expect(res.body).toHaveProperty('workStart');
    expect(res.body).toHaveProperty('workEnd');
    expect(Array.isArray(res.body.officeLocations)).toBe(true);
  });

  it('Intern GET /attendance/settings → 403 (không có attendance.config_read)', async () => {
    await get(SETTINGS, await tokenFor('internVideo')).expect(403);
  });

  it('chưa đăng nhập GET → 401', async () => {
    await get(SETTINGS, null).expect(401);
  });
});

describe('Phân quyền GHI — chỉ Super Admin (attendance.config globalOnly, US-ATT-03 AC7)', () => {
  // Cả bốn vai trò non-superadmin (kể cả Admin/User có quyền ĐỌC) đều KHÔNG được GHI.
  const nonWriters: ActorOrAnonymous[] = ['adminAudio', 'adminAudioVideo', 'userMarketing', 'internVideo'];

  it.each(nonWriters)('%s gọi mọi endpoint ghi → 403', async (actor) => {
    const token = await tokenFor(actor);
    await patch(SETTINGS, token, { workStart: '09:00' }).expect(403);
    await post(LOCATIONS, token, { name: 'VP', latitude: 10, longitude: 106 }).expect(403);
    await patch(`${LOCATIONS}/${randomUUID()}`, token, { name: 'x' }).expect(403);
    await del(`${LOCATIONS}/${randomUUID()}`, token).expect(403);
  });

  it('chưa đăng nhập ghi → 401', async () => {
    await patch(SETTINGS, null, { workStart: '09:00' }).expect(401);
    await post(LOCATIONS, null, { name: 'VP', latitude: 10, longitude: 106 }).expect(401);
    await patch(`${LOCATIONS}/${randomUUID()}`, null, { name: 'x' }).expect(401);
    await del(`${LOCATIONS}/${randomUUID()}`, null).expect(401);
  });
});

describe('PATCH /attendance/settings — lưu lịch + audit', () => {
  it('Super Admin lưu lịch → 200, DB có 1 bản ghi, audit_logs ghi before/after', async () => {
    const token = await tokenFor('superAdmin');
    const before = await prisma.auditLog.count({ where: { action: 'attendance.settings.update' } });

    const res = await patch(SETTINGS, token, {
      workStart: '08:30',
      workEnd: '18:00',
      lunchStart: '12:00',
      lunchEnd: '13:30',
      workDays: [1, 2, 3, 4, 5, 6],
      monthlyLateAllowanceMin: 45,
    }).expect(200);

    expect(res.body.workStart).toBe('08:30');
    expect(res.body.workEnd).toBe('18:00');
    expect(res.body.workDays).toEqual([1, 2, 3, 4, 5, 6]);
    expect(res.body.monthlyLateAllowanceMin).toBe(45);

    expect(await prisma.attendanceSettings.count()).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'attendance.settings.update' } })).toBe(before + 1);
  });

  it('PATCH nhiều lần vẫn chỉ một bản ghi singleton', async () => {
    const token = await tokenFor('superAdmin');
    await patch(SETTINGS, token, { monthlyLateAllowanceMin: 30 }).expect(200);
    await patch(SETTINGS, token, { monthlyLateAllowanceMin: 70 }).expect(200);
    expect(await prisma.attendanceSettings.count()).toBe(1);

    const res = await get(SETTINGS, token).expect(200);
    expect(res.body.monthlyLateAllowanceMin).toBe(70);
    // Giữ nguyên trường không gửi.
    expect(res.body.workStart).toBe('08:30');
  });

  it('bỏ nghỉ trưa (null) → lưu null', async () => {
    const token = await tokenFor('superAdmin');
    const res = await patch(SETTINGS, token, { lunchStart: null, lunchEnd: null }).expect(200);
    expect(res.body.lunchStart).toBeNull();
    expect(res.body.lunchEnd).toBeNull();
  });
});

describe('PATCH /attendance/settings — validate → 400', () => {
  const token = () => tokenFor('superAdmin');
  const bad: Array<[string, object, RegExp]> = [
    ['giờ sai định dạng', { workStart: '25:00' }, /HH:mm/],
    ['giờ ra ≤ giờ vào', { workStart: '10:00', workEnd: '09:00' }, /Giờ ra phải sau giờ vào/],
    ['nghỉ trưa ngoài giờ làm', { lunchStart: '07:00', lunchEnd: '07:30' }, /Nghỉ trưa phải nằm trong giờ làm/],
    ['lunchStart ≥ lunchEnd', { lunchStart: '13:00', lunchEnd: '12:00' }, /Giờ kết thúc nghỉ trưa/],
    ['workDays rỗng', { workDays: [] }, /ít nhất một ngày/],
    ['workDays ngoài 1–7', { workDays: [0, 8] }, /1–7/],
    ['quota âm', { monthlyLateAllowanceMin: -1 }, /không được âm/],
  ];

  it.each(bad)('%s → 400', async (_l, body, re) => {
    const res = await patch(SETTINGS, await token(), body).expect(400);
    expect(JSON.stringify(res.body.message)).toMatch(re);
  });
});

describe('Office locations — CRUD + xoá mềm', () => {
  it('tạo điểm (thiếu radiusM → 150) → 201, audit ghi', async () => {
    const token = await tokenFor('superAdmin');
    const before = await prisma.auditLog.count({ where: { action: 'attendance.office_location.create' } });

    const res = await post(LOCATIONS, token, { name: 'Văn phòng HCM', latitude: 10.776, longitude: 106.7 }).expect(201);

    expect(res.body).toMatchObject({ name: 'Văn phòng HCM', radiusM: 150, isActive: true });
    expect(res.body.latitude).toBeCloseTo(10.776, 5);
    expect(await prisma.auditLog.count({ where: { action: 'attendance.office_location.create' } })).toBe(before + 1);

    // Điểm xuất hiện trong GET settings.
    const settings = await get(SETTINGS, token).expect(200);
    expect(settings.body.officeLocations.some((l: { id: string }) => l.id === res.body.id)).toBe(true);
  });

  it('sửa điểm → 200, audit ghi before/after', async () => {
    const token = await tokenFor('superAdmin');
    const created = await post(LOCATIONS, token, { name: 'VP2', latitude: 11, longitude: 107, radiusM: 200 }).expect(201);
    const before = await prisma.auditLog.count({ where: { action: 'attendance.office_location.update' } });

    const res = await patch(`${LOCATIONS}/${created.body.id}`, token, { name: 'VP2 mới', isActive: false }).expect(200);

    expect(res.body).toMatchObject({ name: 'VP2 mới', isActive: false, radiusM: 200 });
    expect(await prisma.auditLog.count({ where: { action: 'attendance.office_location.update' } })).toBe(before + 1);
  });

  it('xoá mềm → 204, giữ bản ghi trong DB, loại khỏi GET, audit ghi', async () => {
    const token = await tokenFor('superAdmin');
    const created = await post(LOCATIONS, token, { name: 'VP tạm', latitude: 12, longitude: 108 }).expect(201);
    const id = created.body.id;
    const before = await prisma.auditLog.count({ where: { action: 'attendance.office_location.delete' } });

    await del(`${LOCATIONS}/${id}`, token).expect(204);

    const row = await prisma.officeLocation.findUnique({ where: { id } });
    expect(row).not.toBeNull();
    expect(row?.deletedAt).not.toBeNull();

    const settings = await get(SETTINGS, token).expect(200);
    expect(settings.body.officeLocations.some((l: { id: string }) => l.id === id)).toBe(false);
    expect(await prisma.auditLog.count({ where: { action: 'attendance.office_location.delete' } })).toBe(before + 1);
  });

  it('sửa điểm đã xoá mềm → 404', async () => {
    const token = await tokenFor('superAdmin');
    const created = await post(LOCATIONS, token, { name: 'VP xoá', latitude: 13, longitude: 109 }).expect(201);
    await del(`${LOCATIONS}/${created.body.id}`, token).expect(204);

    await patch(`${LOCATIONS}/${created.body.id}`, token, { name: 'x' }).expect(404);
    await del(`${LOCATIONS}/${created.body.id}`, token).expect(404);
  });

  it('sửa điểm không tồn tại → 404', async () => {
    await patch(`${LOCATIONS}/${randomUUID()}`, await tokenFor('superAdmin'), { name: 'x' }).expect(404);
  });

  const badLocations: Array<[string, object, RegExp]> = [
    ['tên rỗng', { name: '', latitude: 10, longitude: 106 }, /Tên điểm/],
    ['latitude > 90', { name: 'x', latitude: 91, longitude: 106 }, /Vĩ độ/],
    ['longitude > 180', { name: 'x', latitude: 10, longitude: 181 }, /Kinh độ/],
    ['radiusM < 20', { name: 'x', latitude: 10, longitude: 106, radiusM: 10 }, /Bán kính/],
    ['radiusM > 5000', { name: 'x', latitude: 10, longitude: 106, radiusM: 6000 }, /Bán kính/],
  ];

  it.each(badLocations)('tạo điểm %s → 400', async (_l, body, re) => {
    const res = await post(LOCATIONS, await tokenFor('superAdmin'), body).expect(400);
    expect(JSON.stringify(res.body.message)).toMatch(re);
  });
});
