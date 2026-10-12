import { PERMISSIONS, ROLES } from '@cms/shared-types';
import { screen, waitFor } from '@testing-library/react';
import type { Mock } from 'vitest';
import { api } from '@/lib/api';
import { loginWithGrants, permissionsOf, renderWithProviders } from '@/test-utils';
import { UsersPage } from './users-page';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: vi.fn() };
});

const DEPT_AUDIO = '11111111-1111-4111-8111-111111111111';
const CREATE_BUTTON = { name: 'Tạo người dùng' };

const apiMock = api as unknown as Mock;

beforeEach(() => {
  apiMock.mockReset();
  apiMock.mockResolvedValue([]);
});

describe('UsersPage — nút Tạo người dùng (AC2)', () => {
  it('ẩn nút với vai trò User', async () => {
    loginWithGrants({ global: [], departments: { [DEPT_AUDIO]: permissionsOf(ROLES.USER) } });
    renderWithProviders(<UsersPage />);
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/users'));
    expect(screen.queryByRole('button', CREATE_BUTTON)).not.toBeInTheDocument();
  });

  it('ẩn nút với vai trò Intern', async () => {
    loginWithGrants({ global: [], departments: { [DEPT_AUDIO]: permissionsOf(ROLES.INTERN) } });
    renderWithProviders(<UsersPage />);
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/users'));
    expect(screen.queryByRole('button', CREATE_BUTTON)).not.toBeInTheDocument();
  });

  it('hiện nút với Admin có user.create ở phòng ban', async () => {
    loginWithGrants({ global: [], departments: { [DEPT_AUDIO]: [PERMISSIONS.USER_CREATE] } });
    renderWithProviders(<UsersPage />);
    expect(await screen.findByRole('button', CREATE_BUTTON)).toBeInTheDocument();
  });
});
