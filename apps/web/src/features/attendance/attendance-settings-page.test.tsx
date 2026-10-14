import type { AttendanceSettings } from '@cms/shared-types';
import { PERMISSIONS, ROLES } from '@cms/shared-types';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { toast } from 'sonner';
import type { Mock } from 'vitest';
import { AppLayout } from '@/app/app-layout';
import { ApiError, api } from '@/lib/api';
import { loginWithGrants, permissionsOf, renderWithProviders } from '@/test-utils';
import { AttendanceSettingsPage } from './attendance-settings-page';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() }, Toaster: () => null }));

const DEPT_AUDIO = '11111111-1111-4111-8111-111111111111';
const LOC_ID = 'aaaaaaaa-1111-4111-8111-111111111111';

const DEFAULT_SETTINGS: AttendanceSettings = {
  workStart: '08:00',
  workEnd: '17:00',
  lunchStart: '12:00',
  lunchEnd: '13:00',
  workDays: [1, 2, 3, 4, 5],
  monthlyLateAllowanceMin: 60,
  timezone: 'Asia/Ho_Chi_Minh',
  officeLocations: [],
};

const apiGetMock = api.get as unknown as Mock;
const apiPatchMock = api.patch as unknown as Mock;
const apiPostMock = api.post as unknown as Mock;
const apiDeleteMock = api.delete as unknown as Mock;

function mockSettings(settings: AttendanceSettings = DEFAULT_SETTINGS) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/attendance/settings') return Promise.resolve(settings);
    return Promise.reject(new Error(`Không mong đợi gọi GET ${path}`));
  });
}

function loginAsSuperAdmin() {
  loginWithGrants({ global: permissionsOf(ROLES.SUPER_ADMIN), departments: {} });
}

/** Admin một phòng — kể cả có attendance.config gắn nhầm vào phòng thì vẫn không được lọt. */
function loginAsDepartmentAdmin() {
  loginWithGrants({
    global: [],
    departments: { [DEPT_AUDIO]: [...permissionsOf(ROLES.ADMIN), PERMISSIONS.ATTENDANCE_CONFIG] },
  });
}

/**
 * Admin/User read-only: có attendance.config_read ở phạm vi global nhưng KHÔNG có
 * attendance.config (US-ATT-03 AC8, decisions.md 2026-10-14). Thấy màn, không sửa được.
 */
function loginAsReadOnly() {
  loginWithGrants({ global: [PERMISSIONS.ATTENDANCE_CONFIG_READ], departments: {} });
}

/** Intern: không có cả hai quyền → màn bị ẩn/redirect. */
function loginAsIntern() {
  loginWithGrants({ global: [], departments: { [DEPT_AUDIO]: [...permissionsOf(ROLES.INTERN)] } });
}

function patchSettingsCalls() {
  return apiPatchMock.mock.calls.filter(([path]) => path === '/attendance/settings');
}

beforeEach(() => {
  apiGetMock.mockReset();
  apiPatchMock.mockReset();
  apiPostMock.mockReset();
  apiDeleteMock.mockReset();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  mockSettings();
  apiPatchMock.mockResolvedValue(DEFAULT_SETTINGS);
  apiPostMock.mockResolvedValue({ id: LOC_ID, name: 'x', latitude: 0, longitude: 0, radiusM: 150, isActive: true });
  apiDeleteMock.mockResolvedValue(undefined);
});

describe('Ẩn màn & menu với người không có attendance.config', () => {
  it('menu không hiện mục Chấm công với Admin phòng (kể cả gắn nhầm scope phòng)', async () => {
    loginAsDepartmentAdmin();
    renderWithProviders(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<div>trang chủ</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('trang chủ')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Chấm công/ })).not.toBeInTheDocument();
  });

  it('menu hiện mục Chấm công với Super Admin', async () => {
    loginAsSuperAdmin();
    renderWithProviders(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<div>trang chủ</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('link', { name: /Chấm công/ })).toBeInTheDocument();
  });

  it('vào thẳng route mà không có quyền thì bị đẩy về trang chủ', async () => {
    loginAsDepartmentAdmin();
    renderWithProviders(
      <MemoryRouter initialEntries={['/settings/attendance']}>
        <Routes>
          <Route index element={<div>trang chủ</div>} />
          <Route path="settings/attendance" element={<AttendanceSettingsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('trang chủ')).toBeInTheDocument();
    expect(screen.queryByText('Cấu hình chấm công')).not.toBeInTheDocument();
    expect(apiGetMock).not.toHaveBeenCalled();
  });
});

function renderPage() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/settings/attendance']}>
      <Routes>
        <Route index element={<div>trang chủ</div>} />
        <Route path="settings/attendance" element={<AttendanceSettingsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AC8: Admin/User read-only (attendance.config_read, không có attendance.config)', () => {
  it('hiện màn với dữ liệu, không bị ẩn/redirect', async () => {
    loginAsReadOnly();
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Cấu hình chấm công' })).toBeInTheDocument();
    expect(screen.queryByText('trang chủ')).not.toBeInTheDocument();
    // Vẫn gọi GET để hiển thị cấu hình (chỉ đọc).
    await waitFor(() => expect(apiGetMock).toHaveBeenCalledWith('/attendance/settings'));
  });

  it('input chính disabled', async () => {
    loginAsReadOnly();
    renderPage();

    expect(await screen.findByLabelText('Giờ vào')).toBeDisabled();
    expect(screen.getByLabelText('Giờ ra')).toBeDisabled();
    expect(screen.getByLabelText('Bắt đầu nghỉ trưa')).toBeDisabled();
    for (const short of ['T2', 'T3', 'T4', 'T5', 'T6']) {
      expect(screen.getByRole('checkbox', { name: short })).toBeDisabled();
    }
  });

  it('không có nút Lưu / Thêm điểm / Sửa / Xoá', async () => {
    loginAsReadOnly();
    mockSettings({
      ...DEFAULT_SETTINGS,
      officeLocations: [{ id: LOC_ID, name: 'Trụ sở', latitude: 10.7, longitude: 106.7, radiusM: 150, isActive: true }],
    });
    renderPage();

    // Chờ bảng điểm đổ dữ liệu (xác nhận màn đã render đầy đủ ở chế độ đọc).
    expect(await screen.findByText('Trụ sở')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lưu lịch làm việc' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Thêm điểm/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sửa Trụ sở' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xoá Trụ sở' })).not.toBeInTheDocument();
  });

  it('có banner "Chỉ Super Admin được chỉnh cấu hình chấm công"', async () => {
    loginAsReadOnly();
    renderPage();

    expect(
      await screen.findByText('Chỉ Super Admin được chỉnh cấu hình chấm công.'),
    ).toBeInTheDocument();
  });

  it('Super Admin KHÔNG thấy banner read-only (ghi được)', async () => {
    loginAsSuperAdmin();
    renderPage();

    await screen.findByLabelText('Giờ vào');
    expect(screen.queryByText('Chỉ Super Admin được chỉnh cấu hình chấm công.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu lịch làm việc' })).toBeInTheDocument();
  });

  it('Intern (không có quyền đọc) bị đẩy về trang chủ, không gọi API', async () => {
    loginAsIntern();
    renderPage();

    expect(await screen.findByText('trang chủ')).toBeInTheDocument();
    expect(screen.queryByText('Cấu hình chấm công')).not.toBeInTheDocument();
    expect(apiGetMock).not.toHaveBeenCalled();
  });
});

describe('AttendanceSettingsPage — lịch làm việc', () => {
  it('AC1: hiển thị cấu hình hiện tại từ GET /attendance/settings', async () => {
    loginAsSuperAdmin();
    renderPage();

    expect(await screen.findByLabelText('Giờ vào')).toHaveValue('08:00');
    expect(screen.getByLabelText('Giờ ra')).toHaveValue('17:00');
    expect(screen.getByLabelText('Bắt đầu nghỉ trưa')).toHaveValue('12:00');
    expect(screen.getByLabelText('Múi giờ')).toHaveValue('Asia/Ho_Chi_Minh');
  });

  it('AC2: lưu lịch gọi PATCH /attendance/settings với nghỉ trưa đã khai', async () => {
    const user = userEvent.setup();
    loginAsSuperAdmin();
    renderPage();

    await screen.findByLabelText('Giờ vào');
    await user.click(screen.getByRole('button', { name: 'Lưu lịch làm việc' }));

    await waitFor(() => expect(patchSettingsCalls()).toHaveLength(1));
    expect(patchSettingsCalls()[0][1]).toEqual({
      workStart: '08:00',
      workEnd: '17:00',
      lunchStart: '12:00',
      lunchEnd: '13:00',
      workDays: [1, 2, 3, 4, 5],
      monthlyLateAllowanceMin: 60,
    });
    expect(toast.success).toHaveBeenCalledWith('Đã lưu lịch làm việc');
  });

  it('AC6: tắt nghỉ trưa thì gửi lunchStart/lunchEnd = null', async () => {
    const user = userEvent.setup();
    loginAsSuperAdmin();
    renderPage();

    await screen.findByLabelText('Giờ vào');
    await user.click(screen.getByLabelText('Có nghỉ trưa'));
    await user.click(screen.getByRole('button', { name: 'Lưu lịch làm việc' }));

    await waitFor(() => expect(patchSettingsCalls()).toHaveLength(1));
    const body = patchSettingsCalls()[0][1];
    expect(body.lunchStart).toBeNull();
    expect(body.lunchEnd).toBeNull();
  });

  it('AC6: giờ ra ≤ giờ vào thì báo lỗi, không gọi API', async () => {
    const user = userEvent.setup();
    loginAsSuperAdmin();
    renderPage();

    const workEnd = await screen.findByLabelText('Giờ ra');
    await user.clear(workEnd);
    await user.type(workEnd, '07:00');
    await user.click(screen.getByRole('button', { name: 'Lưu lịch làm việc' }));

    expect(await screen.findByText('Giờ ra phải sau giờ vào')).toBeInTheDocument();
    expect(patchSettingsCalls()).toHaveLength(0);
  });

  it('AC6: bỏ hết ngày làm việc thì báo lỗi, không gọi API', async () => {
    const user = userEvent.setup();
    loginAsSuperAdmin();
    renderPage();

    await screen.findByLabelText('Giờ vào');
    for (const short of ['T2', 'T3', 'T4', 'T5', 'T6']) {
      await user.click(screen.getByRole('checkbox', { name: short }));
    }
    await user.click(screen.getByRole('button', { name: 'Lưu lịch làm việc' }));

    expect(await screen.findByText('Chọn ít nhất một ngày làm việc')).toBeInTheDocument();
    expect(patchSettingsCalls()).toHaveLength(0);
  });

  it('AC6: lỗi 400 lọt từ backend thì hiển thị message backend', async () => {
    const user = userEvent.setup();
    loginAsSuperAdmin();
    apiPatchMock.mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', 'Giờ ra phải sau giờ vào (server)'));
    renderPage();

    await screen.findByLabelText('Giờ vào');
    await user.click(screen.getByRole('button', { name: 'Lưu lịch làm việc' }));

    expect(await screen.findByText('Giờ ra phải sau giờ vào (server)')).toBeInTheDocument();
  });
});

describe('AttendanceSettingsPage — điểm văn phòng', () => {
  it('danh sách rỗng hiện hướng dẫn thêm điểm đầu tiên', async () => {
    loginAsSuperAdmin();
    renderPage();
    expect(await screen.findByText(/Thêm điểm đầu tiên/)).toBeInTheDocument();
  });

  it('AC3: thêm điểm gọi POST /attendance/office-locations với đúng body', async () => {
    const user = userEvent.setup();
    loginAsSuperAdmin();
    renderPage();

    await screen.findByLabelText('Giờ vào');
    await user.click(screen.getByRole('button', { name: /Thêm điểm/ }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Tên điểm'), 'Trụ sở');
    await user.type(within(dialog).getByLabelText(/Vĩ độ/), '10.776');
    await user.type(within(dialog).getByLabelText(/Kinh độ/), '106.7');
    await user.click(within(dialog).getByRole('button', { name: 'Thêm điểm' }));

    await waitFor(() => {
      const calls = apiPostMock.mock.calls.filter(([p]) => p === '/attendance/office-locations');
      expect(calls).toHaveLength(1);
      expect(calls[0][1]).toEqual({ name: 'Trụ sở', latitude: 10.776, longitude: 106.7, radiusM: 150 });
    });
    expect(toast.success).toHaveBeenCalledWith('Đã thêm điểm văn phòng');
  });

  it('AC6: điểm sai bán kính thì báo lỗi, không gọi API', async () => {
    const user = userEvent.setup();
    loginAsSuperAdmin();
    renderPage();

    await screen.findByLabelText('Giờ vào');
    await user.click(screen.getByRole('button', { name: /Thêm điểm/ }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Tên điểm'), 'Trụ sở');
    await user.type(within(dialog).getByLabelText(/Vĩ độ/), '10');
    await user.type(within(dialog).getByLabelText(/Kinh độ/), '106');
    const radius = within(dialog).getByLabelText('Bán kính (m)');
    await user.clear(radius);
    await user.type(radius, '5');
    await user.click(within(dialog).getByRole('button', { name: 'Thêm điểm' }));

    expect(await within(dialog).findByText(/Bán kính từ 20 đến 5000 m/)).toBeInTheDocument();
    expect(apiPostMock.mock.calls.filter(([p]) => p === '/attendance/office-locations')).toHaveLength(0);
  });

  it('AC5: xoá điểm hỏi xác nhận rồi gọi DELETE', async () => {
    const user = userEvent.setup();
    loginAsSuperAdmin();
    mockSettings({
      ...DEFAULT_SETTINGS,
      officeLocations: [{ id: LOC_ID, name: 'Trụ sở', latitude: 10.7, longitude: 106.7, radiusM: 150, isActive: true }],
    });
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Xoá Trụ sở' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Xoá điểm "Trụ sở"/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Xoá' }));

    await waitFor(() =>
      expect(apiDeleteMock).toHaveBeenCalledWith(`/attendance/office-locations/${LOC_ID}`),
    );
    expect(toast.success).toHaveBeenCalledWith('Đã xoá điểm văn phòng');
  });

  it('AC4: sửa điểm gọi PATCH /attendance/office-locations/:id', async () => {
    const user = userEvent.setup();
    loginAsSuperAdmin();
    mockSettings({
      ...DEFAULT_SETTINGS,
      officeLocations: [{ id: LOC_ID, name: 'Trụ sở', latitude: 10.7, longitude: 106.7, radiusM: 150, isActive: true }],
    });
    apiPatchMock.mockResolvedValue({ id: LOC_ID, name: 'Trụ sở 2', latitude: 10.7, longitude: 106.7, radiusM: 200, isActive: true });
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Sửa Trụ sở' }));
    const dialog = await screen.findByRole('dialog');
    const name = within(dialog).getByLabelText('Tên điểm');
    await user.clear(name);
    await user.type(name, 'Trụ sở 2');
    await user.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => {
      const calls = apiPatchMock.mock.calls.filter(([p]) => p === `/attendance/office-locations/${LOC_ID}`);
      expect(calls).toHaveLength(1);
      expect(calls[0][1]).toMatchObject({ name: 'Trụ sở 2', radiusM: 150, isActive: true });
    });
    expect(toast.success).toHaveBeenCalledWith('Đã cập nhật điểm văn phòng');
  });
});
