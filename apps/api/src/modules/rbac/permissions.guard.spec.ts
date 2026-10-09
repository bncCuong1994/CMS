import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS, type PermissionGrants } from '@cms/shared-types';
import { PermissionRequirement } from '../../common/decorators';
import { PermissionsGuard } from './permissions.guard';

const DEPT_A = '00000000-0000-0000-0000-00000000000a';
const DEPT_B = '00000000-0000-0000-0000-00000000000b';

function run(requirement: PermissionRequirement | undefined, grants: PermissionGrants, request: object = {}) {
  const reflector = {
    getAllAndOverride: (key: string) => (key === 'requiredPermission' ? requirement : undefined),
  } as unknown as Reflector;
  const ctx = {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u', email: 'e', grants }, ...request }) }),
  } as unknown as ExecutionContext;
  return new PermissionsGuard(reflector).canActivate(ctx);
}

const adminOfA: PermissionGrants = { global: [], departments: { [DEPT_A]: [PERMISSIONS.USER_CREATE, PERMISSIONS.USER_READ] } };
const superAdmin: PermissionGrants = { global: [PERMISSIONS.USER_CREATE, PERMISSIONS.DEPARTMENT_MANAGE], departments: {} };

describe('PermissionsGuard', () => {
  const createInDept = {
    permission: PERMISSIONS.USER_CREATE,
    departmentFrom: { source: 'body', key: 'departmentId' },
  } as PermissionRequirement;

  it('cho qua khi endpoint không yêu cầu quyền', () => {
    expect(run(undefined, { global: [], departments: {} })).toBe(true);
  });

  it('Admin được thao tác ở phòng mình được gán', () => {
    expect(run(createInDept, adminOfA, { body: { departmentId: DEPT_A } })).toBe(true);
  });

  it('Admin bị chặn ở phòng không được gán', () => {
    expect(() => run(createInDept, adminOfA, { body: { departmentId: DEPT_B } })).toThrow(ForbiddenException);
  });

  it('chặn khi thiếu phòng ban mà người dùng không có quyền global', () => {
    expect(() => run(createInDept, adminOfA, { body: {} })).toThrow(ForbiddenException);
  });

  it('quyền global áp dụng cho mọi phòng', () => {
    expect(run(createInDept, superAdmin, { body: { departmentId: DEPT_B } })).toBe(true);
  });

  it('globalOnly chỉ chấp nhận quyền global', () => {
    const req = { permission: PERMISSIONS.DEPARTMENT_MANAGE, globalOnly: true } as PermissionRequirement;
    const deptManager: PermissionGrants = { global: [], departments: { [DEPT_A]: [PERMISSIONS.DEPARTMENT_MANAGE] } };
    expect(() => run(req, deptManager)).toThrow(ForbiddenException);
    expect(run(req, superAdmin)).toBe(true);
  });
});
