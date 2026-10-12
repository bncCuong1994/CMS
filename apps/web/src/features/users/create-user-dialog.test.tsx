import { PERMISSIONS, ROLES } from '@cms/shared-types';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { toast } from 'sonner';
import type { Mock } from 'vitest';
import { ApiError, api } from '@/lib/api';
import { loginWithGrants, permissionsOf, renderWithProviders } from '@/test-utils';
import { useUsers } from './api';
import { CreateUserDialog } from './create-user-dialog';

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
const apiPostMock = api.post as unknown as Mock;

function mockApi(createHandler?: () => unknown) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/departments') return Promise.resolve(DEPARTMENTS);
    if (path === '/users') return Promise.resolve([]);
    return Promise.reject(new Error(`Không mong đợi gọi GET ${path}`));
  });
  apiPostMock.mockImplementation((path: string) => {
    if (path === '/users') {
      return createHandler
        ? Promise.resolve(createHandler())
        : Promise.resolve({ id: 'new', email: 'a@b.local', fullName: 'A B', status: 'active' });
    }
    return Promise.reject(new Error(`Không mong đợi gọi POST ${path}`));
  });
}

/** Admin một phòng, có cả `role.manage` ở phạm vi phòng ban (bẫy của AC8). */
function loginAsDepartmentAdmin() {
  loginWithGrants({
    global: [],
    departments: { [DEPT_AUDIO]: [...permissionsOf(ROLES.ADMIN), PERMISSIONS.ROLE_MANAGE] },
  });
}

function loginAsSuperAdmin() {
  loginWithGrants({ global: permissionsOf(ROLES.SUPER_ADMIN), departments: {} });
}

async function openDialog(user: UserEvent) {
  await user.click(screen.getByRole('button', { name: 'Tạo người dùng' }));
  return screen.getByRole('dialog');
}

async function chooseOption(user: UserEvent, comboboxName: RegExp, optionName: string) {
  await user.click(screen.getByRole('combobox', { name: comboboxName }));
  await user.click(await screen.findByRole('option', { name: optionName }));
}

function postCalls() {
  return apiPostMock.mock.calls.filter(([path]) => path === '/users');
}

function listUsersCalls() {
  return apiGetMock.mock.calls.filter(([path]) => path === '/users');
}

/**
 * Chỉ dùng trong test: đăng ký một observer cho query `['users']` để kiểm tra
 * `invalidateQueries` sau khi tạo có thực sự nạp lại `GET /users` (AC5).
 */
function UsersListProbe() {
  const { data } = useUsers();
  return <div data-testid="users-probe">{data?.length ?? 0}</div>;
}

beforeEach(() => {
  apiGetMock.mockReset();
  apiPostMock.mockReset();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  mockApi();
});

describe('CreateUserDialog', () => {
  it('AC1: mở popup hiện đủ các trường và khối quyền chỉ đọc', async () => {
    const user = userEvent.setup();
    loginAsSuperAdmin();
    renderWithProviders(<CreateUserDialog />);

    const dialog = await openDialog(user);
    for (const label of [/Họ tên/, /^Email$/, /Mật khẩu/, /Số điện thoại/, /Chức danh/]) {
      expect(within(dialog).getByLabelText(label)).toBeInTheDocument();
    }
    expect(within(dialog).getByRole('combobox', { name: /Phòng ban/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('combobox', { name: /Vai trò/ })).toBeInTheDocument();
    expect(within(dialog).getByText('Quyền của vai trò này')).toBeInTheDocument();
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('AC7: thiếu trường bắt buộc và email sai định dạng thì báo lỗi, không gọi API', async () => {
    const user = userEvent.setup();
    loginAsSuperAdmin();
    renderWithProviders(<CreateUserDialog />);

    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText(/^Email$/), 'sai-dinh-dang');
    await user.type(within(dialog).getByLabelText(/Mật khẩu/), '123');
    await user.click(within(dialog).getByRole('button', { name: 'Tạo' }));

    expect(await within(dialog).findByText('Email không đúng định dạng')).toBeInTheDocument();
    expect(within(dialog).getByText('Mật khẩu tối thiểu 8 ký tự')).toBeInTheDocument();
    expect(within(dialog).getByText('Họ tên tối thiểu 2 ký tự')).toBeInTheDocument();
    expect(within(dialog).getByText('Vui lòng chọn phòng ban')).toBeInTheDocument();
    expect(postCalls()).toHaveLength(0);
  });

  it('AC7: số điện thoại quá 20 ký tự thì báo lỗi, không gọi API', async () => {
    const user = userEvent.setup();
    loginAsSuperAdmin();
    renderWithProviders(<CreateUserDialog />);

    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText(/Họ tên/), 'Nguyễn Văn A');
    await user.type(within(dialog).getByLabelText(/^Email$/), 'nhanvien@cms.local');
    await user.type(within(dialog).getByLabelText(/Mật khẩu/), 'MatKhau@123');
    await user.type(within(dialog).getByLabelText(/Số điện thoại/), '0'.repeat(21));
    await chooseOption(user, /Phòng ban/, 'Audio');
    await user.click(within(dialog).getByRole('button', { name: 'Tạo' }));

    expect(await within(dialog).findByText('Số điện thoại tối đa 20 ký tự')).toBeInTheDocument();
    expect(postCalls()).toHaveLength(0);
  });

  it('AC4: khối quyền cập nhật theo vai trò đang chọn', async () => {
    const user = userEvent.setup();
    loginAsSuperAdmin();
    renderWithProviders(<CreateUserDialog />);

    await openDialog(user);
    const preview = screen.getByTestId('role-permissions');
    // AC4 chốt con số: vai trò USER có đúng 5 quyền, INTERN có đúng 2 quyền.
    expect(within(preview).getAllByRole('listitem')).toHaveLength(5);

    await chooseOption(user, /Vai trò/, 'Intern');

    await waitFor(() => expect(within(preview).getAllByRole('listitem')).toHaveLength(2));
    expect(within(preview).getByText('department.read')).toBeInTheDocument();
    expect(within(preview).getByText('task.update_own')).toBeInTheDocument();
    expect(within(preview).getByText('Cập nhật việc được giao cho mình')).toBeInTheDocument();
  });

  it('AC8: ẩn lựa chọn Admin khi chỉ có role.manage ở phạm vi phòng ban', async () => {
    const user = userEvent.setup();
    loginAsDepartmentAdmin();
    renderWithProviders(<CreateUserDialog />);

    await openDialog(user);
    await user.click(screen.getByRole('combobox', { name: /Vai trò/ }));

    expect(await screen.findByRole('option', { name: 'User' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Intern' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('AC8: Super Admin (role.manage global) thấy lựa chọn Admin', async () => {
    const user = userEvent.setup();
    loginAsSuperAdmin();
    renderWithProviders(<CreateUserDialog />);

    await openDialog(user);
    await user.click(screen.getByRole('combobox', { name: /Vai trò/ }));

    expect(await screen.findByRole('option', { name: 'Admin' })).toBeInTheDocument();
  });

  it('AC3: dropdown phòng ban hiện đúng dữ liệu GET /departments, không tự lọc theo grants', async () => {
    const user = userEvent.setup();
    loginAsDepartmentAdmin();
    renderWithProviders(<CreateUserDialog />);

    await openDialog(user);
    await user.click(screen.getByRole('combobox', { name: /Phòng ban/ }));

    expect(await screen.findByRole('option', { name: 'Audio' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Video' })).toBeInTheDocument();
  });

  it('AC6: lỗi 409 hiện dưới trường Email, popup không đóng và giữ dữ liệu', async () => {
    const user = userEvent.setup();
    loginAsSuperAdmin();
    mockApi(() => {
      throw new ApiError(409, 'CONFLICT', 'Email đã được sử dụng');
    });
    renderWithProviders(<CreateUserDialog />);

    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText(/Họ tên/), 'Nguyễn Văn A');
    await user.type(within(dialog).getByLabelText(/^Email$/), 'admin@cms.local');
    await user.type(within(dialog).getByLabelText(/Mật khẩu/), 'MatKhau@123');
    await chooseOption(user, /Phòng ban/, 'Audio');
    await user.click(within(dialog).getByRole('button', { name: 'Tạo' }));

    expect(await within(dialog).findByText('Email đã được sử dụng')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^Email$/)).toHaveValue('admin@cms.local');
    expect(within(dialog).getByLabelText(/Họ tên/)).toHaveValue('Nguyễn Văn A');
    expect(postCalls()).toHaveLength(1);
  });

  it('AC5: tạo thành công thì gửi đúng body, đóng popup, báo thành công và làm mới danh sách', async () => {
    const user = userEvent.setup();
    loginAsSuperAdmin();
    renderWithProviders(
      <>
        <UsersListProbe />
        <CreateUserDialog />
      </>,
    );
    await waitFor(() => expect(listUsersCalls()).toHaveLength(1));

    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText(/Họ tên/), 'Nguyễn Văn A');
    await user.type(within(dialog).getByLabelText(/^Email$/), 'nhanvien@cms.local');
    await user.type(within(dialog).getByLabelText(/Mật khẩu/), 'MatKhau@123');
    await user.type(within(dialog).getByLabelText(/Số điện thoại/), '0901234567');
    await chooseOption(user, /Phòng ban/, 'Audio');
    await user.click(within(dialog).getByRole('button', { name: 'Tạo' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(postCalls()[0][1]).toEqual({
      email: 'nhanvien@cms.local',
      fullName: 'Nguyễn Văn A',
      password: 'MatKhau@123',
      phone: '0901234567',
      departmentId: DEPT_AUDIO,
      role: 'USER',
    });
    expect(toast.success).toHaveBeenCalledWith('Đã tạo người dùng');
    // invalidateQueries(['users']) phải khiến danh sách được nạp lại, không chỉ đóng popup.
    await waitFor(() => expect(listUsersCalls().length).toBeGreaterThan(1));
  });

  it('nút hiện/ẩn mật khẩu đổi kiểu input', async () => {
    const user = userEvent.setup();
    loginAsSuperAdmin();
    renderWithProviders(<CreateUserDialog />);

    const dialog = await openDialog(user);
    const password = within(dialog).getByLabelText(/Mật khẩu/);
    expect(password).toHaveAttribute('type', 'password');
    await user.click(within(dialog).getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(within(dialog).getByLabelText(/Mật khẩu/)).toHaveAttribute('type', 'text');
  });
});
