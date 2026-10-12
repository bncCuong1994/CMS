import { PERMISSIONS, ROLES } from '@cms/shared-types';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Mock } from 'vitest';
import { api } from '@/lib/api';
import { loginWithGrants, permissionsOf, renderWithProviders } from '@/test-utils';
import type { PaginatedUsers, UserRow } from './api';
import { UsersPage } from './users-page';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

const DEPT_AUDIO = '11111111-1111-4111-8111-111111111111';
const CREATE_BUTTON = { name: 'Tạo người dùng' };
const EMPTY_USERS = { data: [], meta: { total: 0, page: 1, pageSize: 20 } };

const apiGetMock = api.get as unknown as Mock;

/** `GET /users` trả envelope phân trang; `GET /departments` trả mảng (US-USERS-03). */
function mockGet() {
  apiGetMock.mockImplementation((url: string) =>
    Promise.resolve(url === '/users' ? EMPTY_USERS : []),
  );
}

/** Khớp lời gọi `GET /users` bất kể params filter/paging. */
function expectUsersFetched() {
  return expect(apiGetMock).toHaveBeenCalledWith('/users', expect.anything());
}

beforeEach(() => {
  apiGetMock.mockReset();
  mockGet();
});

describe('UsersPage — nút Tạo người dùng (AC2)', () => {
  it('ẩn nút với vai trò User', async () => {
    loginWithGrants({ global: [], departments: { [DEPT_AUDIO]: permissionsOf(ROLES.USER) } });
    renderWithProviders(<UsersPage />);
    await waitFor(() => expectUsersFetched());
    expect(screen.queryByRole('button', CREATE_BUTTON)).not.toBeInTheDocument();
  });

  it('ẩn nút với vai trò Intern', async () => {
    loginWithGrants({ global: [], departments: { [DEPT_AUDIO]: permissionsOf(ROLES.INTERN) } });
    renderWithProviders(<UsersPage />);
    await waitFor(() => expectUsersFetched());
    expect(screen.queryByRole('button', CREATE_BUTTON)).not.toBeInTheDocument();
  });

  it('hiện nút với Admin có user.create ở phòng ban', async () => {
    loginWithGrants({ global: [], departments: { [DEPT_AUDIO]: [PERMISSIONS.USER_CREATE] } });
    renderWithProviders(<UsersPage />);
    expect(await screen.findByRole('button', CREATE_BUTTON)).toBeInTheDocument();
  });
});

// ── US-USERS-03: tìm kiếm, lọc, cột chức danh, phân trang ─────────────────────

const DEPT_VIDEO = '22222222-2222-4222-8222-222222222222';

const DEPARTMENTS = [
  { id: DEPT_AUDIO, name: 'Audio', code: 'AUDIO', description: null, memberCount: 1 },
  { id: DEPT_VIDEO, name: 'Video Editor', code: 'VIDEO', description: null, memberCount: 1 },
];

function userRow(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 'u-row-1',
    email: 'a@cms.local',
    fullName: 'Nguyễn Văn A',
    phone: '0901234567',
    position: 'Chuyên viên',
    status: 'active',
    lastLoginAt: null,
    departments: [{ id: DEPT_AUDIO, name: 'Audio' }],
    roles: [{ role: 'USER', departmentId: DEPT_AUDIO }],
    ...overrides,
  };
}

function usersPage(rows: UserRow[], meta?: Partial<PaginatedUsers['meta']>): PaginatedUsers {
  return { data: rows, meta: { total: rows.length, page: 1, pageSize: 20, ...meta } };
}

/** Cho phép mỗi test quyết định payload của `/users`; `/departments` trả danh sách chuẩn. */
function mockGetWith(usersResponse: () => PaginatedUsers) {
  apiGetMock.mockImplementation((url: string) =>
    Promise.resolve(url === '/users' ? usersResponse() : DEPARTMENTS),
  );
}

/** Đăng nhập Super Admin (thấy toàn bộ, không bị ẩn cột/bộ lọc). */
function loginSuperAdmin() {
  loginWithGrants({ global: permissionsOf(ROLES.SUPER_ADMIN), departments: {} });
}

/** Lấy lần gọi `GET /users` gần nhất và params đã gửi lên. */
function lastUsersParams(): Record<string, unknown> {
  const calls = apiGetMock.mock.calls.filter((c) => c[0] === '/users');
  const last = calls[calls.length - 1];
  return (last?.[1]?.params ?? {}) as Record<string, unknown>;
}

describe('UsersPage — cột Chức danh (AC1)', () => {
  it('render dữ liệu position vào cột Chức danh', async () => {
    loginSuperAdmin();
    mockGetWith(() => usersPage([userRow({ position: 'Biên tập viên' })]));
    renderWithProviders(<UsersPage />);

    expect(await screen.findByRole('columnheader', { name: 'Chức danh' })).toBeInTheDocument();
    const row = (await screen.findByText('Nguyễn Văn A')).closest('tr')!;
    expect(within(row).getByText('Biên tập viên')).toBeInTheDocument();
  });

  it('position rỗng → hiện dấu – trong cột Chức danh', async () => {
    loginSuperAdmin();
    mockGetWith(() =>
      usersPage([userRow({ position: null, phone: '0900000000', lastLoginAt: '2026-10-10T03:00:00.000Z' })]),
    );
    renderWithProviders(<UsersPage />);

    const row = (await screen.findByText('Nguyễn Văn A')).closest('tr')!;
    // phone và lastLoginAt có giá trị nên dấu – duy nhất là ở cột Chức danh.
    expect(within(row).getByText('–')).toBeInTheDocument();
  });
});

describe('UsersPage — tìm kiếm (AC2)', () => {
  it('gõ vào ô tìm kiếm → sau debounce gọi /users với params.q', async () => {
    loginSuperAdmin();
    mockGetWith(() => usersPage([]));
    renderWithProviders(<UsersPage />);
    await waitFor(() => expectUsersFetched());

    await userEvent.type(screen.getByLabelText('Tìm kiếm'), 'Minh');

    await waitFor(() => expect(lastUsersParams().q).toBe('Minh'));
  });
});

describe('UsersPage — bộ lọc chọn nhiều (AC3) và phân trang (AC4)', () => {
  /**
   * Mở popover của một MultiSelectFilter (trigger có aria-label = nhãn) rồi tick các mục theo tên.
   * MultiSelectFilter dùng popover + checkbox (không còn Radix Select / role="option").
   */
  async function toggleFilterOptions(filterLabel: string, optionNames: string[]) {
    await userEvent.click(screen.getByRole('button', { name: filterLabel }));
    for (const name of optionNames) {
      // Checkbox gắn với <label> chứa text; getByRole('checkbox', { name }) khớp qua label.
      await userEvent.click(await screen.findByRole('checkbox', { name }));
    }
  }

  it('chọn một Vai trò → params.role đúng chuỗi và page=1', async () => {
    loginSuperAdmin();
    mockGetWith(() => usersPage([]));
    renderWithProviders(<UsersPage />);
    await waitFor(() => expectUsersFetched());

    await toggleFilterOptions('Vai trò', ['Intern']);

    await waitFor(() => {
      const p = lastUsersParams();
      expect(p.role).toBe(ROLES.INTERN);
      expect(p.page).toBe(1);
    });
  });

  it('chọn nhiều Vai trò → params.role là chuỗi phẩy-ngăn-cách đã sort tăng dần', async () => {
    loginSuperAdmin();
    mockGetWith(() => usersPage([]));
    renderWithProviders(<UsersPage />);
    await waitFor(() => expectUsersFetched());

    // Tick Intern rồi User — kết quả phải sort tăng dần → 'INTERN,USER'.
    await toggleFilterOptions('Vai trò', ['Intern', 'User']);

    await waitFor(() => {
      const p = lastUsersParams();
      expect(p.role).toBe('INTERN,USER');
      expect(p.page).toBe(1);
    });
  });

  it('chọn nhiều bộ lọc khác nhau → cả hai param xuất hiện', async () => {
    loginSuperAdmin();
    mockGetWith(() => usersPage([]));
    renderWithProviders(<UsersPage />);
    await waitFor(() => expectUsersFetched());

    await toggleFilterOptions('Vai trò', ['Intern']);
    await toggleFilterOptions('Trạng thái', ['Đã khoá']);

    await waitFor(() => {
      const p = lastUsersParams();
      expect(p.role).toBe(ROLES.INTERN);
      expect(p.status).toBe('locked');
    });
  });

  it('chọn nhiều Trạng thái → params.status là chuỗi phẩy đã sort', async () => {
    loginSuperAdmin();
    mockGetWith(() => usersPage([]));
    renderWithProviders(<UsersPage />);
    await waitFor(() => expectUsersFetched());

    // Hoạt động (active) + Đã khoá (locked) → sort tăng dần → 'active,locked'.
    await toggleFilterOptions('Trạng thái', ['Hoạt động', 'Đã khoá']);

    await waitFor(() => expect(lastUsersParams().status).toBe('active,locked'));
  });

  it('chọn một Phòng ban → params.departmentId là id của phòng', async () => {
    loginSuperAdmin();
    mockGetWith(() => usersPage([]));
    renderWithProviders(<UsersPage />);
    await waitFor(() => expectUsersFetched());

    await toggleFilterOptions('Phòng ban', ['Video Editor']);

    await waitFor(() => expect(lastUsersParams().departmentId).toBe(DEPT_VIDEO));
  });

  it('chọn nhiều Phòng ban → params.departmentId là chuỗi phẩy các id đã sort', async () => {
    loginSuperAdmin();
    mockGetWith(() => usersPage([]));
    renderWithProviders(<UsersPage />);
    await waitFor(() => expectUsersFetched());

    await toggleFilterOptions('Phòng ban', ['Audio', 'Video Editor']);

    await waitFor(() => {
      const expected = [DEPT_AUDIO, DEPT_VIDEO].sort().join(',');
      expect(lastUsersParams().departmentId).toBe(expected);
    });
  });

  it('bỏ chọn hết một bộ lọc → param đó biến mất', async () => {
    loginSuperAdmin();
    mockGetWith(() => usersPage([]));
    renderWithProviders(<UsersPage />);
    await waitFor(() => expectUsersFetched());

    // Mở popover một lần; tick Intern rồi untick ngay trong cùng phiên mở (popover không tự đóng
    // khi click checkbox). Kết thúc: mảng rỗng → param role phải biến mất.
    await userEvent.click(screen.getByRole('button', { name: 'Vai trò' }));
    const internCheckbox = await screen.findByRole('checkbox', { name: 'Intern' });

    await userEvent.click(internCheckbox); // tick
    await waitFor(() => expect(lastUsersParams().role).toBe(ROLES.INTERN));

    await userEvent.click(internCheckbox); // untick → rỗng
    await waitFor(() => expect(lastUsersParams().role).toBeUndefined());
  });

  it('đổi bộ lọc luôn reset page về 1', async () => {
    loginSuperAdmin();
    // total > pageSize để sang được trang 2 trước khi đổi filter.
    mockGetWith(() => usersPage([userRow()], { total: 50, page: 1, pageSize: 20 }));
    renderWithProviders(<UsersPage />);
    await screen.findByText('Nguyễn Văn A');

    await userEvent.click(screen.getByRole('button', { name: 'Sau' }));
    await waitFor(() => expect(lastUsersParams().page).toBe(2));

    // Đổi filter khi đang ở trang 2 → page phải về 1.
    await toggleFilterOptions('Vai trò', ['Intern']);
    await waitFor(() => {
      const p = lastUsersParams();
      expect(p.role).toBe(ROLES.INTERN);
      expect(p.page).toBe(1);
    });
  });

  it('bấm "Sau" → gọi /users với params.page=2', async () => {
    loginSuperAdmin();
    // total > pageSize để nút "Sau" không bị disable.
    mockGetWith(() => usersPage([userRow()], { total: 50, page: 1, pageSize: 20 }));
    renderWithProviders(<UsersPage />);
    await screen.findByText('Nguyễn Văn A');

    await userEvent.click(screen.getByRole('button', { name: 'Sau' }));

    await waitFor(() => expect(lastUsersParams().page).toBe(2));
  });
});

describe('UsersPage — trạng thái rỗng (AC5)', () => {
  it('rỗng do lọc → "Không tìm thấy người dùng phù hợp."', async () => {
    loginSuperAdmin();
    mockGetWith(() => usersPage([]));
    renderWithProviders(<UsersPage />);
    await waitFor(() => expectUsersFetched());

    await userEvent.type(screen.getByLabelText('Tìm kiếm'), 'khong-ai-khop');

    expect(await screen.findByText('Không tìm thấy người dùng phù hợp.')).toBeInTheDocument();
    expect(screen.queryByText('Chưa có người dùng nào.')).not.toBeInTheDocument();
  });

  it('rỗng thật, không filter → "Chưa có người dùng nào."', async () => {
    loginSuperAdmin();
    mockGetWith(() => usersPage([]));
    renderWithProviders(<UsersPage />);

    expect(await screen.findByText('Chưa có người dùng nào.')).toBeInTheDocument();
    expect(screen.queryByText('Không tìm thấy người dùng phù hợp.')).not.toBeInTheDocument();
  });
});
