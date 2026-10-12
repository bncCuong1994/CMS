import { DEFAULT_ROLES, PERMISSION_DESCRIPTIONS, type Permission } from '@cms/shared-types';
import type { AssignableRole } from './schemas';

/** Quyền mặc định của một vai trò, lấy từ `DEFAULT_ROLES` (chưa có `GET /roles`, xem giả định 3). */
export function getRolePermissions(role: AssignableRole): Permission[] {
  return DEFAULT_ROLES.find((r) => r.code === role)?.permissions ?? [];
}

/** Khối xem trước quyền của vai trò đang chọn. Chỉ đọc, không có checkbox. */
export function RolePermissionsPreview({ role }: { role: AssignableRole }) {
  const permissions = getRolePermissions(role);

  return (
    <div className="rounded-md border bg-muted/40 p-3" data-testid="role-permissions">
      <p className="text-sm font-medium">Quyền của vai trò này</p>
      <p className="text-xs text-muted-foreground">
        Chỉ để xem. Quyền được quyết định bởi vai trò, không gán riêng cho từng người.
      </p>
      {permissions.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Vai trò này chưa có quyền nào.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1">
          {permissions.map((p) => (
            <li key={p} className="flex flex-wrap items-baseline gap-2 text-sm">
              <code className="rounded bg-background px-1.5 py-0.5 text-xs">{p}</code>
              <span className="text-muted-foreground">{PERMISSION_DESCRIPTIONS[p]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
