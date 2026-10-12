import { PERMISSIONS, ROLES } from '@cms/shared-types';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { toast } from 'sonner';
import type { Mock } from 'vitest';
import { api } from '@/lib/api';
import { loginWithGrants, permissionsOf, renderWithProviders } from '@/test-utils';
import type { UserRow } from './api';
import { EditUserDialog } from './edit-user-dialog';
import { UsersPage } from './users-page';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const DEPT_AUDIO = '11111111-1111-4111-8111-111111111111';
const DEPT_VIDEO = '22222222-2222-4222-8222-222222222222';
const DEPARTMENTS = [
  { id: DEPT_AUDIO, name: 'Audio', code: 'AUDIO', description: null, memberCount: 2 },
  { id: DEPT_VIDEO, name: 'Video', code: 'VIDEO', description: null, memberCount: 3 },
];

const apiGetMock = api.get as unknown as Mock;
const apiPatchMock = api.patch as unknown as Mock;

function userRow(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 'u-edit-1',
    email: 'nhanvien@cms.local',
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

function mockApi() {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/departments') return Promise.resolve(DEPARTMENTS);
    if (path === '/users') return Promise.resolve({ data: [], meta: { total: 0, page: 1, pageSize: 20 } });
    return Promise.reject(new Error(`Không mong đợi gọi GET ${path}`));
  });
  apiPatchMock.mockResolvedValue(userRow());
}

function loginAsDepartmentAdmin() {
  // Admin một phòng có cả role.manage ở phạm vi phòng (bẫy AC6/AC8).
  loginWithGrants({
    global: [],
    departments: { [DEPT_AUDIO]: [...permissionsOf(ROLES.ADMIN), PERMISSIONS.ROLE_MANAGE] },
  });
}

function loginAsSuperAdmin() {
  loginWithGrants({ global: permissionsOf(ROLES.SUPER_ADMIN), departments: {} });
}

function patchCalls() {
  return apiPatchMock.mock.calls.filter(([path]) => String(path).startsWith('/users/'));
}

const noop = () => {};

beforeEach(() => {
  apiGetMock.mockReset();
  apiPatchMock.mockReset();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  mockApi();
});

// ── AC2: nút "Sửa" ẩn với User/Intern, hiện với người có user.update ─────────
describe('UsersPage — nút Sửa (AC2)', () => {
  function mockListWithRow() {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/users') {
        return Promise.resolve({ data: [userRow()], meta: { total: 1, page: 1, pageSize: 20 } });
      }
      return Promise.resolve(DEPARTMENTS);
    });
  }

  it('ẩn nút Sửa với vai trò User', async () => {
    mockListWithRow();
    loginWithGrants({ global: [], departments: { [DEPT_AUDIO]: permissionsOf(ROLES.USER) } });
    renderWithProviders(<UsersPage />);

    expect(await screen.findByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sửa Nguyễn Văn A/ })).not.toBeInTheDocument();
  });

  it('ẩn nút Sửa với vai trò Intern', async () => {
    mockListWithRow();
    loginWithGrants({ global: [], departments: { [DEPT_AUDIO]: permissionsOf(ROLES.INTERN) } });
    renderWithProviders(<UsersPage />);

    expect(await screen.findByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sửa Nguyễn Văn A/ })).not.toBeInTheDocument();
  });

  it('hiện nút Sửa với Admin có user.update trong phòng của dòng', async () => {
    mockListWithRow();
    loginWithGrants({ global: [], departments: { [DEPT_AUDIO]: [PERMISSIONS.USER_UPDATE] } });
    renderWithProviders(<UsersPage />);

    expect(await screen.findByRole('button', { name: /Sửa Nguyễn Văn A/ })).toBeInTheDocument();
  });
});

// ── AC1: form điền sẵn dữ liệu hiện tại ──────────────────────────────────────
describe('EditUserDialog — form điền sẵn (AC1)', () => {
  it('điền sẵn họ tên, SĐT, chức danh, phòng ban và vai trò hiện tại', async () => {
    loginAsSuperAdmin();
    const user = userRow({
      fullName: 'Trần Thị B',
      phone: '0988888888',
      position: 'Trưởng nhóm',
      departments: [{ id: DEPT_AUDIO, name: 'Audio' }],
      roles: [{ role: 'INTERN', departmentId: DEPT_AUDIO }],
    });
    renderWithProviders(<EditUserDialog user={user} open onOpenChange={noop} />);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/Họ tên/)).toHaveValue('Trần Thị B');
    expect(within(dialog).getByLabelText(/Số điện thoại/)).toHaveValue('0988888888');
    expect(within(dialog).getByLabelText(/Chức danh/)).toHaveValue('Trưởng nhóm');
    // Vai trò điền sẵn Intern.
    expect(within(dialog).getByRole('combobox', { name: 'Vai trò' })).toHaveTextContent('Intern');
    // Phòng ban điền sẵn: nút multi-select hiện (1) đã chọn.
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Phòng ban' })).toHaveTextContent('Phòng ban (1)'),
    );
  });
});

// ── AC9: validate chặn submit, không gọi API ─────────────────────────────────
describe('EditUserDialog — validate chặn submit (AC9)', () => {
  it('fullName < 2 ký tự → báo lỗi, không gọi PATCH', async () => {
    const user = userEvent.setup();
    loginAsSuperAdmin();
    renderWithProviders(<EditUserDialog user={userRow()} open onOpenChange={noop} />);

    const dialog = await screen.findByRole('dialog');
    const fullName = within(dialog).getByLabelText(/Họ tên/);
    await user.clear(fullName);
    await user.type(fullName, 'A');
    await user.click(within(dialog).getByRole('button', { name: 'Lưu' }));

    expect(await within(dialog).findByText('Họ tên tối thiểu 2 ký tự')).toBeInTheDocument();
    expect(patchCalls()).toHaveLength(0);
  });

  it('departmentIds rỗng → báo lỗi "Chọn ít nhất một phòng ban", không gọi PATCH', async () => {
    const user = userEvent.setup();
    loginAsSuperAdmin();
    // Bắt đầu với 1 phòng rồi gỡ hết (Super Admin, phạm vi global → có thể bỏ chọn).
    renderWithProviders(<EditUserDialog user={userRow()} open onOpenChange={noop} />);

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Phòng ban' }));
    // Bỏ chọn Audio (phòng đang chọn sẵn).
    await user.click(await screen.findByRole('checkbox', { name: 'Audio' }));
    await user.click(within(dialog).getByRole('button', { name: 'Lưu' }));

    expect(await within(dialog).findByText('Chọn ít nhất một phòng ban')).toBeInTheDocument();
    expect(patchCalls()).toHaveLength(0);
  });
});

// ── AC6: lựa chọn ADMIN ẩn với Admin (không có role.manage global) ───────────
describe('EditUserDialog — ẩn lựa chọn ADMIN (AC6)', () => {
  it('Admin phòng không thấy lựa chọn Admin trong dropdown vai trò', async () => {
    const user = userEvent.setup();
    loginAsDepartmentAdmin();
    renderWithProviders(<EditUserDialog user={userRow()} open onOpenChange={noop} />);

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('combobox', { name: 'Vai trò' }));

    expect(await screen.findByRole('option', { name: 'User' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Intern' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('Super Admin (role.manage global) thấy lựa chọn Admin', async () => {
    const user = userEvent.setup();
    loginAsSuperAdmin();
    renderWithProviders(<EditUserDialog user={userRow()} open onOpenChange={noop} />);

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('combobox', { name: 'Vai trò' }));

    expect(await screen.findByRole('option', { name: 'Admin' })).toBeInTheDocument();
  });
});

// ── AC3: sửa thành công gửi body + toast + đóng ──────────────────────────────
describe('EditUserDialog — sửa thành công (AC3)', () => {
  it('gửi PATCH đúng body, báo thành công và đóng dialog', async () => {
    const user = userEvent.setup();
    loginAsSuperAdmin();
    const onOpenChange = vi.fn();
    renderWithProviders(<EditUserDialog user={userRow()} open onOpenChange={onOpenChange} />);

    const dialog = await screen.findByRole('dialog');
    const fullName = within(dialog).getByLabelText(/Họ tên/);
    await user.clear(fullName);
    await user.type(fullName, 'Tên Đã Sửa');
    await user.click(within(dialog).getByRole('button', { name: 'Lưu' }));

    await waitFor(() => expect(patchCalls()).toHaveLength(1));
    expect(patchCalls()[0][0]).toBe('/users/u-edit-1');
    expect(patchCalls()[0][1]).toEqual({
      fullName: 'Tên Đã Sửa',
      phone: '0901234567',
      position: 'Chuyên viên',
      departmentIds: [DEPT_AUDIO],
      role: 'USER',
    });
    expect(toast.success).toHaveBeenCalledWith('Đã cập nhật người dùng');
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
