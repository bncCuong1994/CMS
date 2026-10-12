import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import {
  type ActorOrAnonymous,
  type TokenFor,
  type World,
  TEST_PASSWORD,
  createTokenFor,
  seedWorld,
  withAuth,
} from './fixtures/actors';
import { createPrismaClient, createTestApp, truncateAll } from './helpers/test-app';

const ENDPOINT = '/api/v1/users';

let app: INestApplication;
let prisma: PrismaClient;
let world: World;
let tokenFor: TokenFor;

/** Mỗi lời gọi tạo email duy nhất để không phụ thuộc thứ tự chạy. */
let emailSeq = 0;
const uniqueEmail = (prefix = 'bulk') => `${prefix}.${(emailSeq += 1)}.${randomUUID().slice(0, 8)}@test.local`;

interface Row {
  id: string;
  email: string;
  fullName: string;
  position: string | null;
  status: string;
  departments: { id: string; name: string }[];
  roles: { role: string; departmentId: string | null }[];
}

interface ListResponse {
  data: Row[];
  meta: { total: number; page: number; pageSize: number };
}

function getUsers(token: string | null, query: Record<string, string | number> = {}) {
  return withAuth(request(app.getHttpServer()).get(ENDPOINT).query(query), token);
}

/**
 * Tạo thêm người dùng USER thật trong một phòng cho các ca phân trang/tìm/lọc.
 * Trả về id để assert tập kết quả.
 */
async function seedUser(opts: {
  departmentId: string;
  roleCode: string;
  fullName?: string;
  email?: string;
  status?: 'active' | 'inactive' | 'locked';
}): Promise<{ id: string; email: string; fullName: string }> {
  const role = await prisma.role.findUniqueOrThrow({ where: { code: opts.roleCode } });
  const email = (opts.email ?? uniqueEmail()).toLowerCase();
  const fullName = opts.fullName ?? 'Nhan Vien Seed';
  const user = await prisma.user.create({
    data: {
      email,
      fullName,
      passwordHash: await argon2.hash(TEST_PASSWORD),
      status: opts.status ?? 'active',
      lastActivityAt: new Date(),
      departments: { create: { departmentId: opts.departmentId } },
      roles: { create: { roleId: role.id, scopeType: 'department', scopeId: opts.departmentId } },
    },
    select: { id: true, email: true, fullName: true },
  });
  return user;
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

describe('GET /api/v1/users — envelope phân trang', () => {
  it('trả đúng hình dạng { data, meta } với meta.page/pageSize/total', async () => {
    const res = await getUsers(await tokenFor('superAdmin')).expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toEqual({
      total: expect.any(Number),
      page: 1,
      pageSize: 20,
    });
    // meta.total phản ánh toàn bộ phạm vi (7 actor seed), không chỉ số dòng trả về.
    expect(res.body.meta.total).toBe(await prisma.user.count({ where: { deletedAt: null } }));
  });

  it('mỗi dòng có đủ trường hợp đồng (id/email/fullName/position/status/departments/roles)', async () => {
    const res = await getUsers(await tokenFor('superAdmin')).expect(200);
    const row = res.body.data[0] as Row;

    expect(row).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        email: expect.any(String),
        fullName: expect.any(String),
        status: expect.any(String),
        departments: expect.any(Array),
        roles: expect.any(Array),
      }),
    );
    expect(row).toHaveProperty('position');
    // Không rò passwordHash qua select.
    expect(row).not.toHaveProperty('passwordHash');
  });
});

describe('GET /api/v1/users — phân trang', () => {
  const dept = () => world.departments.AUDIO;
  // Phòng AUDIO đã có 2 actor seed (adminAudio, adminAudioVideo). Thêm cho đủ tập lớn.
  const EXTRA = 23;
  const PAGE_SIZE = 5;
  const seededIds: string[] = [];

  beforeAll(async () => {
    for (let i = 0; i < EXTRA; i += 1) {
      const u = await seedUser({ departmentId: dept(), roleCode: 'USER', fullName: `Phan Trang ${i}` });
      seededIds.push(u.id);
    }
  });

  it('page=2&pageSize=N: data.length đúng, meta đúng, không trùng trang 1', async () => {
    const token = await tokenFor('superAdmin');
    const total = await prisma.user.count({
      where: { deletedAt: null, departments: { some: { departmentId: dept() } } },
    });
    expect(total).toBeGreaterThan(PAGE_SIZE); // tiền đề: đủ nhiều để sang trang 2.

    const p1 = await getUsers(token, { departmentId: dept(), page: 1, pageSize: PAGE_SIZE }).expect(200);
    const p2 = await getUsers(token, { departmentId: dept(), page: 2, pageSize: PAGE_SIZE }).expect(200);

    const body1 = p1.body as ListResponse;
    const body2 = p2.body as ListResponse;

    expect(body1.data).toHaveLength(PAGE_SIZE);
    expect(body2.data).toHaveLength(PAGE_SIZE);
    expect(body2.meta).toEqual({ total, page: 2, pageSize: PAGE_SIZE });
    expect(body1.meta.total).toBe(total);

    // take/skip đúng: trang 1 và trang 2 không giao nhau.
    const ids1 = new Set(body1.data.map((r) => r.id));
    const overlap = body2.data.filter((r) => ids1.has(r.id));
    expect(overlap).toHaveLength(0);
  });

  it('trang cuối trả phần dư đúng; tổng các trang gộp lại = meta.total không trùng lặp', async () => {
    const token = await tokenFor('superAdmin');
    const total = await prisma.user.count({
      where: { deletedAt: null, departments: { some: { departmentId: dept() } } },
    });
    const lastPage = Math.ceil(total / PAGE_SIZE);

    const seen = new Set<string>();
    for (let page = 1; page <= lastPage; page += 1) {
      const res = await getUsers(token, { departmentId: dept(), page, pageSize: PAGE_SIZE }).expect(200);
      for (const r of (res.body as ListResponse).data) seen.add(r.id);
    }
    // Gộp mọi trang: đúng total bản ghi, không trùng (Set loại trùng → size phải = total).
    expect(seen.size).toBe(total);

    const lastRes = await getUsers(token, { departmentId: dept(), page: lastPage, pageSize: PAGE_SIZE }).expect(200);
    const expectedLast = total - (lastPage - 1) * PAGE_SIZE;
    expect((lastRes.body as ListResponse).data).toHaveLength(expectedLast);
  });
});

describe('GET /api/v1/users — tìm kiếm q (ILIKE contains, không phân biệt hoa/thường)', () => {
  let target: { id: string; email: string; fullName: string };

  beforeAll(async () => {
    target = await seedUser({
      departmentId: world.departments.AUDIO,
      roleCode: 'USER',
      fullName: 'Zxcvbnm Unikname Target',
      email: `zxcv-unique-${randomUUID().slice(0, 8)}@test.local`,
    });
  });

  it('q khớp một phần fullName → chỉ trả người khớp tên', async () => {
    const res = await getUsers(await tokenFor('superAdmin'), { q: 'Unikname' }).expect(200);
    const body = res.body as ListResponse;

    expect(body.data.map((r) => r.id)).toContain(target.id);
    expect(body.data.every((r) => /unikname/i.test(r.fullName) || /unikname/i.test(r.email))).toBe(true);
  });

  it('q khớp một phần email → chỉ trả người khớp email', async () => {
    const part = target.email.split('@')[0]; // zxcv-unique-xxxx
    const res = await getUsers(await tokenFor('superAdmin'), { q: part }).expect(200);
    const body = res.body as ListResponse;

    expect(body.data.map((r) => r.id)).toEqual([target.id]);
  });

  it('q không phân biệt hoa/thường (chữ HOA vẫn khớp fullName thường)', async () => {
    const res = await getUsers(await tokenFor('superAdmin'), { q: 'UNIKNAME' }).expect(200);
    expect((res.body as ListResponse).data.map((r) => r.id)).toContain(target.id);
  });

  it('q chỉ gồm khoảng trắng → bỏ qua, không lọc (trả như không có q)', async () => {
    const withSpaces = await getUsers(await tokenFor('superAdmin'), { q: '   ' }).expect(200);
    const without = await getUsers(await tokenFor('superAdmin')).expect(200);
    expect((withSpaces.body as ListResponse).meta.total).toBe((without.body as ListResponse).meta.total);
  });

  it('q không khớp ai → data rỗng, total 0', async () => {
    const res = await getUsers(await tokenFor('superAdmin'), { q: 'khong-ton-tai-chuoi-nay-xyz' }).expect(200);
    expect((res.body as ListResponse).data).toHaveLength(0);
    expect((res.body as ListResponse).meta.total).toBe(0);
  });
});

describe('GET /api/v1/users — lọc role/status/departmentId (chọn nhiều, OR trong 1 bộ lọc)', () => {
  it('role=INTERN (một giá trị dạng mảng) → chỉ người có vai trò INTERN', async () => {
    const res = await getUsers(await tokenFor('superAdmin'), { role: 'INTERN' }).expect(200);
    const body = res.body as ListResponse;

    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.every((r) => r.roles.some((x) => x.role === 'INTERN'))).toBe(true);
    // internVideo + internInactive31d đều phải xuất hiện.
    expect(body.data.map((r) => r.id)).toEqual(
      expect.arrayContaining([world.actors.internVideo.id, world.actors.internInactive31d.id]),
    );
  });

  it('role=USER,INTERN (OR) → trả hợp USER ∪ INTERN, KHÔNG trả ADMIN', async () => {
    // Seed 3 marker mới (newest → nằm ngay trang 1 nhờ orderBy createdAt desc), tránh phụ thuộc
    // vị trí các actor seed cũ trong tập lớn khi lọc chỉ theo role.
    const uUser = await seedUser({ departmentId: world.departments.AUDIO, roleCode: 'USER', fullName: 'OR User Marker' });
    const uIntern = await seedUser({
      departmentId: world.departments.VIDEO,
      roleCode: 'INTERN',
      fullName: 'OR Intern Marker',
    });

    const res = await getUsers(await tokenFor('superAdmin'), { role: 'USER,INTERN', pageSize: 100 }).expect(200);
    const body = res.body as ListResponse;
    const ids = body.data.map((r) => r.id);

    // Mọi dòng phải có ít nhất một vai trò USER hoặc INTERN (OR nội bộ bộ lọc).
    expect(body.data.every((r) => r.roles.some((x) => x.role === 'USER' || x.role === 'INTERN'))).toBe(true);
    // Cả hai nhóm đều có mặt (hợp, không phải giao).
    expect(ids).toEqual(expect.arrayContaining([uUser.id, uIntern.id]));

    // ADMIN thuần (không kèm USER/INTERN) KHÔNG bao giờ lọt vào — kiểm theo tổng, không phụ thuộc trang:
    // meta.total phải đúng = số user trong DB có vai trò USER hoặc INTERN (loại ADMIN thuần).
    const expectedTotal = await prisma.user.count({
      where: { deletedAt: null, roles: { some: { role: { code: { in: ['USER', 'INTERN'] } } } } },
    });
    const adminOnlyCount = await prisma.user.count({
      where: {
        deletedAt: null,
        roles: { some: { role: { code: 'ADMIN' } } },
        NOT: { roles: { some: { role: { code: { in: ['USER', 'INTERN'] } } } } },
      },
    });
    expect(adminOnlyCount).toBeGreaterThan(0); // tiền đề: có Admin thuần trong DB để chứng minh loại trừ.
    expect(body.meta.total).toBe(expectedTotal); // Admin thuần không góp vào total.
  });

  it('role lặp tham số (?role=USER&role=INTERN) ⇒ cùng kết quả với dạng phẩy', async () => {
    const token = await tokenFor('superAdmin');
    const comma = await getUsers(token, { role: 'USER,INTERN' }).expect(200);
    // Supertest: truyền mảng ⇒ lặp tham số role=USER&role=INTERN.
    const repeated = await withAuth(
      request(app.getHttpServer()).get(ENDPOINT).query({ role: ['USER', 'INTERN'] }),
      token,
    ).expect(200);

    const idsComma = (comma.body as ListResponse).data.map((r) => r.id).sort();
    const idsRepeated = (repeated.body as ListResponse).data.map((r) => r.id).sort();
    expect(idsRepeated).toEqual(idsComma);
    expect((repeated.body as ListResponse).meta.total).toBe((comma.body as ListResponse).meta.total);
  });

  it('status=active,locked (OR) → trả hợp active ∪ locked, không trả inactive', async () => {
    const locked = await seedUser({
      departmentId: world.departments.AUDIO,
      roleCode: 'USER',
      status: 'locked',
      fullName: 'Nguoi Bi Khoa OR',
    });
    const inactive = await seedUser({
      departmentId: world.departments.AUDIO,
      roleCode: 'USER',
      status: 'inactive',
      fullName: 'Nguoi Ngung OR',
    });
    const active = await seedUser({
      departmentId: world.departments.AUDIO,
      roleCode: 'USER',
      status: 'active',
      fullName: 'Nguoi Active OR',
    });

    const res = await getUsers(await tokenFor('superAdmin'), { status: 'active,locked' }).expect(200);
    const ids = (res.body as ListResponse).data.map((r) => r.id);

    expect(ids).toEqual(expect.arrayContaining([locked.id, active.id]));
    expect(ids).not.toContain(inactive.id);
    expect((res.body as ListResponse).data.every((r) => r.status === 'active' || r.status === 'locked')).toBe(true);
  });

  it('status=locked (một giá trị) → chỉ người bị khoá', async () => {
    const locked = await seedUser({
      departmentId: world.departments.AUDIO,
      roleCode: 'USER',
      status: 'locked',
      fullName: 'Nguoi Bi Khoa Don',
    });
    const res = await getUsers(await tokenFor('superAdmin'), { status: 'locked' }).expect(200);
    const body = res.body as ListResponse;

    expect(body.data.map((r) => r.id)).toContain(locked.id);
    expect(body.data.every((r) => r.status === 'locked')).toBe(true);
  });

  it('nhiều departmentId (Audio,Video) → trả hợp người của cả hai phòng, không có Marketing', async () => {
    // Marker mới ở mỗi phòng (newest → trang 1) để assert hợp không phụ thuộc vị trí seed cũ.
    const aAudio = await seedUser({ departmentId: world.departments.AUDIO, roleCode: 'USER', fullName: 'Dept Audio Marker' });
    const aVideo = await seedUser({ departmentId: world.departments.VIDEO, roleCode: 'USER', fullName: 'Dept Video Marker' });

    const res = await getUsers(await tokenFor('superAdmin'), {
      departmentId: `${world.departments.AUDIO},${world.departments.VIDEO}`,
      pageSize: 100,
    }).expect(200);
    const body = res.body as ListResponse;
    const ids = body.data.map((r) => r.id);

    expect(body.data.length).toBeGreaterThan(0);
    // Mọi dòng thuộc Audio HOẶC Video (OR nội bộ departmentId).
    expect(
      body.data.every((r) =>
        r.departments.some((d) => d.id === world.departments.AUDIO || d.id === world.departments.VIDEO),
      ),
    ).toBe(true);
    // Cả hai phòng đều góp mặt (hợp, không giao).
    expect(ids).toEqual(expect.arrayContaining([aAudio.id, aVideo.id]));

    // Marketing không lọt vào: total đúng = số user thuộc Audio ∪ Video; userMarketing không góp.
    const expectedTotal = await prisma.user.count({
      where: {
        deletedAt: null,
        departments: { some: { departmentId: { in: [world.departments.AUDIO, world.departments.VIDEO] } } },
      },
    });
    expect(body.meta.total).toBe(expectedTotal);
    const marketingCount = await prisma.user.count({
      where: { deletedAt: null, departments: { some: { departmentId: world.departments.MARKETING } } },
    });
    expect(marketingCount).toBeGreaterThan(0); // tiền đề: có người Marketing để chứng minh loại trừ.
  });

  it('departmentId=VIDEO (một giá trị) → chỉ người thuộc phòng Video', async () => {
    const res = await getUsers(await tokenFor('superAdmin'), { departmentId: world.departments.VIDEO }).expect(200);
    const body = res.body as ListResponse;

    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.every((r) => r.departments.some((d) => d.id === world.departments.VIDEO))).toBe(true);
    // userMarketing (phòng khác) không được lọt vào.
    expect(body.data.map((r) => r.id)).not.toContain(world.actors.userMarketing.id);
  });
});

describe('GET /api/v1/users — AND giữa các bộ lọc', () => {
  it('role=INTERN,USER + departmentId=VIDEO (AND) → chỉ người Video có vai trò INTERN hoặc USER', async () => {
    const res = await getUsers(await tokenFor('superAdmin'), {
      role: 'INTERN,USER',
      departmentId: world.departments.VIDEO,
    }).expect(200);
    const body = res.body as ListResponse;

    // internVideo + internInactive31d thuộc Video và là INTERN → có mặt.
    expect(body.data.map((r) => r.id)).toEqual(
      expect.arrayContaining([world.actors.internVideo.id, world.actors.internInactive31d.id]),
    );
    // userMarketing là USER nhưng ở Marketing → bị loại bởi AND departmentId.
    expect(body.data.map((r) => r.id)).not.toContain(world.actors.userMarketing.id);
    expect(
      body.data.every(
        (r) =>
          r.roles.some((x) => x.role === 'INTERN' || x.role === 'USER') &&
          r.departments.some((d) => d.id === world.departments.VIDEO),
      ),
    ).toBe(true);
  });

  it('role=INTERN + status=locked (AND) → giao đúng tập (Intern bị khoá)', async () => {
    const lockedIntern = await seedUser({
      departmentId: world.departments.VIDEO,
      roleCode: 'INTERN',
      status: 'locked',
      fullName: 'Intern Bi Khoa AND',
    });
    const res = await getUsers(await tokenFor('superAdmin'), { role: 'INTERN', status: 'locked' }).expect(200);
    const body = res.body as ListResponse;

    expect(body.data.map((r) => r.id)).toContain(lockedIntern.id);
    // internVideo là INTERN nhưng active → bị loại bởi AND status=locked.
    expect(body.data.map((r) => r.id)).not.toContain(world.actors.internVideo.id);
    expect(
      body.data.every((r) => r.roles.some((x) => x.role === 'INTERN') && r.status === 'locked'),
    ).toBe(true);
  });

  it('q + role (AND): tên khớp nhưng role không khớp → bị loại', async () => {
    const u = await seedUser({
      departmentId: world.departments.AUDIO,
      roleCode: 'USER',
      fullName: 'Qandrole Special Name',
    });
    // q khớp tên nhưng người đó là USER, lọc role=INTERN → không xuất hiện.
    const res = await getUsers(await tokenFor('superAdmin'), { q: 'Qandrole', role: 'INTERN' }).expect(200);
    expect((res.body as ListResponse).data.map((r) => r.id)).not.toContain(u.id);

    // q + role=USER,INTERN (OR) khớp cả hai điều kiện (tên khớp, vai trò USER ∈ tập) → xuất hiện.
    const res2 = await getUsers(await tokenFor('superAdmin'), { q: 'Qandrole', role: 'USER,INTERN' }).expect(200);
    expect((res2.body as ListResponse).data.map((r) => r.id)).toContain(u.id);
  });
});

describe('GET /api/v1/users — kẹp pageSize', () => {
  it('pageSize=1000 → meta.pageSize=100, không trả 400', async () => {
    const res = await getUsers(await tokenFor('superAdmin'), { pageSize: 1000 }).expect(200);
    expect((res.body as ListResponse).meta.pageSize).toBe(100);
  });

  it('pageSize=1000 trả nhiều nhất 100 dòng', async () => {
    const res = await getUsers(await tokenFor('superAdmin'), { pageSize: 1000 }).expect(200);
    expect((res.body as ListResponse).data.length).toBeLessThanOrEqual(100);
  });
});

describe('GET /api/v1/users — phạm vi phòng ban là AND với mọi filter (CRITICAL)', () => {
  it('Admin Audio tìm q khớp người phòng Marketing → KHÔNG lộ người phòng khác', async () => {
    // userMarketing fullName = "User Marketing" — nằm ngoài phạm vi của adminAudio.
    const res = await getUsers(await tokenFor('adminAudio'), { q: 'Marketing' }).expect(200);
    const body = res.body as ListResponse;

    expect(body.data.map((r) => r.id)).not.toContain(world.actors.userMarketing.id);
    expect(body.data.map((r) => r.id)).not.toContain(world.actors.userInactive31d.id);
    // Mọi dòng trả về phải thuộc phòng adminAudio được gán (AUDIO).
    expect(body.data.every((r) => r.departments.some((d) => d.id === world.departments.AUDIO))).toBe(true);
  });

  it('Admin Audio KHÔNG thấy bất kỳ người phòng Marketing/Video nào trong danh sách mặc định', async () => {
    const res = await getUsers(await tokenFor('adminAudio')).expect(200);
    const body = res.body as ListResponse;
    const ids = body.data.map((r) => r.id);

    expect(ids).not.toContain(world.actors.userMarketing.id);
    expect(ids).not.toContain(world.actors.internVideo.id);
    // Mọi dòng đều thuộc AUDIO.
    expect(body.data.every((r) => r.departments.some((d) => d.id === world.departments.AUDIO))).toBe(true);
  });

  it('Admin Audio lọc departmentId=Marketing → 403, không rò dữ liệu', async () => {
    const res = await getUsers(await tokenFor('adminAudio'), { departmentId: world.departments.MARKETING }).expect(403);
    expect(res.body).not.toHaveProperty('data');
    expect(JSON.stringify(res.body)).not.toContain(world.actors.userMarketing.email);
  });

  it('Admin Audio lọc departmentId=Video (phòng không được gán) → 403', async () => {
    await getUsers(await tokenFor('adminAudio'), { departmentId: world.departments.VIDEO }).expect(403);
  });

  it('Admin Audio lọc mảng [Audio(được gán), Video(ngoài phạm vi)] → 403, không rò dữ liệu', async () => {
    // Bất kỳ id nào ngoài phạm vi → 403, dù phần tử khác thuộc phòng mình.
    const res = await getUsers(await tokenFor('adminAudio'), {
      departmentId: `${world.departments.AUDIO},${world.departments.VIDEO}`,
    }).expect(403);
    expect(res.body).not.toHaveProperty('data');
    expect(JSON.stringify(res.body)).not.toContain(world.actors.internVideo.email);
  });

  it('Admin đa phòng lọc mảng [Audio, Marketing(ngoài phạm vi)] → 403', async () => {
    await getUsers(await tokenFor('adminAudioVideo'), {
      departmentId: `${world.departments.AUDIO},${world.departments.MARKETING}`,
    }).expect(403);
  });

  it('Admin đa phòng lọc mảng [Audio, Video] (đều được gán) → 200', async () => {
    const res = await getUsers(await tokenFor('adminAudioVideo'), {
      departmentId: `${world.departments.AUDIO},${world.departments.VIDEO}`,
    }).expect(200);
    expect(
      (res.body as ListResponse).data.every((r) =>
        r.departments.some((d) => d.id === world.departments.AUDIO || d.id === world.departments.VIDEO),
      ),
    ).toBe(true);
  });

  it('Admin đa phòng (Audio+Video) lọc Video → 200; lọc Marketing → 403', async () => {
    const token = await tokenFor('adminAudioVideo');
    await getUsers(token, { departmentId: world.departments.VIDEO }).expect(200);
    await getUsers(token, { departmentId: world.departments.MARKETING }).expect(403);
  });

  it('Admin đa phòng thấy cả người Audio lẫn Video, không thấy Marketing', async () => {
    const res = await getUsers(await tokenFor('adminAudioVideo')).expect(200);
    const ids = (res.body as ListResponse).data.map((r) => r.id);
    // internVideo (Video) nằm trong phạm vi; userMarketing không.
    expect(ids).not.toContain(world.actors.userMarketing.id);
    expect(
      (res.body as ListResponse).data.every((r) =>
        r.departments.some((d) => d.id === world.departments.AUDIO || d.id === world.departments.VIDEO),
      ),
    ).toBe(true);
  });

  it('User Marketing chỉ thấy người cùng phòng Marketing', async () => {
    const res = await getUsers(await tokenFor('userMarketing')).expect(200);
    const body = res.body as ListResponse;
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.every((r) => r.departments.some((d) => d.id === world.departments.MARKETING))).toBe(true);
    expect(body.data.map((r) => r.id)).not.toContain(world.actors.adminAudio.id);
  });
});

describe('GET /api/v1/users — ma trận phân quyền vào endpoint', () => {
  // [người gọi, HTTP mong đợi khi GET /users không kèm departmentId]
  const matrix: Array<[ActorOrAnonymous, number]> = [
    ['superAdmin', 200],
    ['adminAudio', 200],
    ['adminAudioVideo', 200],
    ['userMarketing', 200],
    ['internVideo', 403], // Intern không có user.read.
    ['anonymous', 401],
  ];

  it.each(matrix)('%s GET /users → %i', async (actor, expected) => {
    await getUsers(await tokenFor(actor)).expect(expected);
  });

  it('Intern có token hợp lệ → 403 (không phải 401): chứng minh bằng /auth/me 200 ngay trước', async () => {
    const token = await tokenFor('internVideo');
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);

    const res = await getUsers(token);
    expect(res.status).toBe(403);
    expect(res.status).not.toBe(401);
    // Không rò dữ liệu người dùng nào.
    expect(res.body).not.toHaveProperty('data');
  });

  it('không token → 401', () => getUsers(null).expect(401));

  it('token chữ ký sai → 401', async () => {
    const [h, p] = (await tokenFor('superAdmin'))!.split('.');
    await getUsers(`${h}.${p}.chu-ky-sai`).expect(401);
  });
});

describe('GET /api/v1/users — validate query', () => {
  it('status ngoài enum → 400', async () => {
    await getUsers(await tokenFor('superAdmin'), { status: 'khong-hop-le' }).expect(400);
  });

  it('role ngoài enum → 400', async () => {
    await getUsers(await tokenFor('superAdmin'), { role: 'KHONG_PHAI_ROLE' }).expect(400);
  });

  it('role có một phần tử sai enum trong mảng (USER,GHOST) → 400', async () => {
    await getUsers(await tokenFor('superAdmin'), { role: 'USER,GHOST' }).expect(400);
  });

  it('status có một phần tử sai enum trong mảng (active,bogus) → 400', async () => {
    await getUsers(await tokenFor('superAdmin'), { status: 'active,bogus' }).expect(400);
  });

  it('page không phải số → 400', async () => {
    await getUsers(await tokenFor('superAdmin'), { page: 'abc' }).expect(400);
  });

  it('departmentId không phải uuid → 400', async () => {
    await getUsers(await tokenFor('superAdmin'), { departmentId: 'khong-phai-uuid' }).expect(400);
  });

  it('departmentId có một phần tử không phải uuid trong mảng → 400', async () => {
    await getUsers(await tokenFor('superAdmin'), {
      departmentId: `${world.departments.AUDIO},khong-phai-uuid`,
    }).expect(400);
  });
});
