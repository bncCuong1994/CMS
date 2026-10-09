---
name: permission-ui
description: Ẩn/hiện chức năng theo quyền và phạm vi phòng ban ở frontend CMS (usePermissions, useCan, <Can>, route guard, bộ chọn phòng cho Admin nhiều phòng). Dùng khi màn hình có nút, menu hay route phụ thuộc vai trò.
---

# Phân quyền ở giao diện

Nhắc lại: đây chỉ là trải nghiệm. Backend luôn kiểm tra lại.

## API dùng chung (`src/shared/permissions/`)
```ts
export const usePermissions = () =>
  useQuery({ queryKey: ['me', 'permissions'], queryFn: () => api.get<MePermissions>('/me/permissions'), staleTime: 5 * 60_000 });

export function useCan(code: PermissionCode, departmentId?: string) {
  const { data } = usePermissions();
  const p = data?.permissions.find(x => x.code === code);
  if (!p) return false;
  if (p.scopes.includes('global')) return true;
  return departmentId ? p.scopes.includes(departmentId) : p.scopes.length > 0;
}

export function Can({ permission, departmentId, children, fallback = null }: CanProps) {
  return useCan(permission, departmentId) ? children : fallback;
}
```
Mã quyền là hằng số `PERMISSIONS.TASK_ASSIGN` từ `@cms/shared-types`, không viết chuỗi tay.

## Route
```tsx
{ path: 'reports', element: <RequirePermission code="analytics.read"><ReportsPage /></RequirePermission> }
```
Chưa đăng nhập → `/login?redirect=...`. Thiếu quyền → trang 403.

## Quy tắc theo vai trò
- Menu sinh từ cấu hình `{ label, path, permission }`, lọc bằng `useCan`.
- INTERN: không có menu Báo cáo, Người dùng, Phòng ban, Vai trò; không có nút tạo/giao việc.
- ADMIN nhiều phòng: header có bộ chọn phòng ban, lưu phòng đang chọn trong Zustand; danh sách lọc theo phòng đã chọn.
- Nhật ký hệ thống chỉ hiện khi có `audit.read` phạm vi global.

## Khi quyền thay đổi
API trả 401 do refresh token bị thu hồi: xoá cache, về `/login`. Sau khi đăng nhập lại, `invalidateQueries(['me'])`.

## Test
Render component với các bộ quyền giả cho 4 vai trò (fixture trong `src/shared/permissions/test-fixtures.ts`), kiểm nút đúng ẩn/hiện.
