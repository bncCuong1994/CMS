import { PERMISSIONS, type MeResponse } from '@cms/shared-types';
import { render, screen } from '@testing-library/react';
import { useAuthStore } from './auth-store';
import { Can } from './can';

const DEPT_A = 'dept-a';
const DEPT_B = 'dept-b';

function loginAs(grants: MeResponse['grants']) {
  useAuthStore.setState({
    accessToken: 't',
    refreshToken: 'r',
    user: { id: 'u', email: 'u@test', fullName: 'U', roles: [], grants },
  });
}

describe('Can', () => {
  it('hiện nội dung khi có quyền ở phòng ban', () => {
    loginAs({ global: [], departments: { [DEPT_A]: [PERMISSIONS.USER_CREATE] } });
    render(
      <Can permission={PERMISSIONS.USER_CREATE} departmentId={DEPT_A}>
        <button>Tạo</button>
      </Can>,
    );
    expect(screen.getByRole('button', { name: 'Tạo' })).toBeInTheDocument();
  });

  it('ẩn nội dung ở phòng ban không được gán', () => {
    loginAs({ global: [], departments: { [DEPT_A]: [PERMISSIONS.USER_CREATE] } });
    render(
      <Can permission={PERMISSIONS.USER_CREATE} departmentId={DEPT_B} fallback={<span>Không có quyền</span>}>
        <button>Tạo</button>
      </Can>,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Không có quyền')).toBeInTheDocument();
  });

  it('quyền global áp dụng mọi phòng', () => {
    loginAs({ global: [PERMISSIONS.USER_CREATE], departments: {} });
    render(
      <Can permission={PERMISSIONS.USER_CREATE} departmentId={DEPT_B}>
        <button>Tạo</button>
      </Can>,
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
