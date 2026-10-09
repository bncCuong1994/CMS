---
name: rbac-scope
description: Cài đặt và dùng kiểm tra quyền theo vai trò + phạm vi phòng ban của CMS (RequirePermission, PermissionGuard, ScopeService, /me/permissions). Dùng khi viết endpoint cần phân quyền hoặc thêm quyền mới.
---

# Phân quyền RBAC + phạm vi

## Mô hình
- `user_roles(user_id, role_id, scope_type, scope_id)`. SUPER_ADMIN: `global`, `scope_id = NULL`. ADMIN/USER/INTERN: `department` + id phòng. Admin nhiều phòng = nhiều dòng.
- Quyền của vai trò lấy từ `role_permissions`. Access token chứa `perms: { code: string; scopes: ('global' | uuid)[] }[]`.

## Hai lớp kiểm tra
1. **PermissionGuard** (toàn cục): đọc `@RequirePermission(code)`, từ chối 403 `FORBIDDEN` nếu người dùng không có mã quyền ở bất kỳ phạm vi nào.
2. **ScopeService** (trong service, vì cần biết tài nguyên thuộc phòng nào):
```ts
assertDepartment(user: AuthUser, perm: string, departmentId: string): void {
  const p = user.perms.find(x => x.code === perm);
  if (!p) throw new AppException('FORBIDDEN', 403);
  if (p.scopes.includes('global') || p.scopes.includes(departmentId)) return;
  throw new AppException('FORBIDDEN_SCOPE', 403);
}
departmentFilter(user: AuthUser, perm: string): Prisma.TaskWhereInput {
  const p = user.perms.find(x => x.code === perm);
  if (!p) throw new AppException('FORBIDDEN', 403);
  return p.scopes.includes('global') ? {} : { departmentId: { in: p.scopes as string[] } };
}
```
Danh sách luôn áp `departmentFilter`, không lọc sau khi lấy dữ liệu.

## Quyền "của bản thân"
- `task.update_own`: người gọi phải nằm trong `task_assignees` của việc. `task.update_any`: theo phạm vi phòng.
- INTERN chỉ có các quyền `*_own`; mọi truy vấn việc của Intern lọc theo `task_assignees.user_id = user.id`.
- Báo cáo: SUPER_ADMIN toàn công ty, ADMIN theo phòng, USER chỉ `user_id = self`, INTERN 403.

## Thêm quyền mới
1. Thêm mã vào `packages/shared-types/src/permissions.ts` (hằng số dùng chung FE/BE).
2. Thêm vào seed và gán cho vai trò phù hợp trong `prisma/seed.ts`.
3. Tạo migration dữ liệu nếu môi trường đã chạy.
4. Ghi vào bảng quyền trong `docs/decisions.md`.

## Khi vai trò thay đổi
Gán/gỡ vai trò, chuyển INTERN → USER, khoá tài khoản: thu hồi mọi `refresh_tokens` của người đó (`revoked_at = now()`), ghi `audit_logs` có `before`/`after`.

## `GET /api/v1/me/permissions`
Trả `{ data: { roles: [{ code, scopeType, scopeId }], permissions: [{ code, scopes }] } }` cho FE.
