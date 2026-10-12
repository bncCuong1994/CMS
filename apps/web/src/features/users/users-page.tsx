import { PERMISSIONS, ROLES } from '@cms/shared-types';
import { Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Can } from '@/features/auth/can';
import { useDepartments } from '@/lib/departments';
import { ROLE_LABELS } from '@/lib/labels';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useUsers, type UserRow } from './api';
import { CreateUserDialog } from './create-user-dialog';
import { EditUserDialog } from './edit-user-dialog';
import { MultiSelectFilter, type MultiSelectOption } from './multi-select-filter';

const EMPTY_CELL = '–';
const PAGE_SIZE = 20;

const STATUS: Record<UserRow['status'], { label: string; variant: 'secondary' | 'outline' | 'destructive' }> = {
  active: { label: 'Hoạt động', variant: 'secondary' },
  inactive: { label: 'Ngừng', variant: 'outline' },
  locked: { label: 'Đã khoá', variant: 'destructive' },
};

const ROLE_ORDER = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.USER, ROLES.INTERN] as const;

const ROLE_OPTIONS: MultiSelectOption[] = ROLE_ORDER.map((r) => ({
  value: r,
  label: ROLE_LABELS[r] ?? r,
}));

const STATUS_ORDER: UserRow['status'][] = ['active', 'inactive', 'locked'];

const STATUS_OPTIONS: MultiSelectOption[] = STATUS_ORDER.map((s) => ({
  value: s,
  label: STATUS[s].label,
}));

export function UsersPage() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState<string[]>([]);
  const [status, setStatus] = useState<UserRow['status'][]>([]);
  const [departmentId, setDepartmentId] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);

  const debouncedQ = useDebouncedValue(q, 300);
  const departmentsQuery = useDepartments();

  const departmentOptions: MultiSelectOption[] = useMemo(
    () => (departmentsQuery.data ?? []).map((d) => ({ value: d.id, label: d.name })),
    [departmentsQuery.data],
  );

  const query = useMemo(
    () => ({
      q: debouncedQ,
      role,
      status,
      departmentId,
      page,
      pageSize: PAGE_SIZE,
    }),
    [debouncedQ, role, status, departmentId, page],
  );

  const { data, isPending, error } = useUsers(query);

  const hasFilters = Boolean(
    debouncedQ.trim() || role.length || status.length || departmentId.length,
  );
  const rows = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** Đổi bất kỳ bộ lọc nào đều reset về trang 1 (AC2/AC3). */
  function onFilterChange(apply: () => void) {
    apply();
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Người dùng</h1>
        <Can permission={PERMISSIONS.USER_CREATE}>
          <CreateUserDialog />
        </Can>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-60 flex-1 flex-col gap-1">
          <Label htmlFor="users-search">Tìm kiếm</Label>
          <Input
            id="users-search"
            placeholder="Tìm theo tên hoặc email"
            value={q}
            onChange={(e) => onFilterChange(() => setQ(e.target.value))}
          />
        </div>

        <MultiSelectFilter
          name="role"
          label="Vai trò"
          options={ROLE_OPTIONS}
          value={role}
          onChange={(next) => onFilterChange(() => setRole(next))}
        />

        <MultiSelectFilter
          name="status"
          label="Trạng thái"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(next) => onFilterChange(() => setStatus(next as UserRow['status'][]))}
        />

        <MultiSelectFilter
          name="department"
          label="Phòng ban"
          options={departmentOptions}
          value={departmentId}
          onChange={(next) => onFilterChange(() => setDepartmentId(next))}
        />
      </div>

      {isPending && <p className="text-muted-foreground">Đang tải...</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      {data && rows.length === 0 && (
        <p className="text-muted-foreground">
          {hasFilters ? 'Không tìm thấy người dùng phù hợp.' : 'Chưa có người dùng nào.'}
        </p>
      )}

      {data && rows.length > 0 && (
        <>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Họ tên</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Số điện thoại</TableHead>
                  <TableHead>Chức danh</TableHead>
                  <TableHead>Phòng ban</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Đăng nhập gần nhất</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.fullName}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.phone ?? EMPTY_CELL}</TableCell>
                    <TableCell>{u.position ?? EMPTY_CELL}</TableCell>
                    <TableCell>{u.departments.map((d) => d.name).join(', ') || EMPTY_CELL}</TableCell>
                    <TableCell>
                      {[...new Set(u.roles.map((r) => ROLE_LABELS[r.role] ?? r.role))].join(', ')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS[u.status].variant}>{STATUS[u.status].label}</Badge>
                    </TableCell>
                    <TableCell>
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('vi-VN') : EMPTY_CELL}
                    </TableCell>
                    <TableCell className="text-right">
                      <Can permission={PERMISSIONS.USER_UPDATE} departmentId={u.departments[0]?.id}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingUser(u)}
                          aria-label={`Sửa ${u.fullName}`}
                        >
                          <Pencil />
                          Sửa
                        </Button>
                      </Can>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Tổng {total} người dùng — Trang {page}/{totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Sau
              </Button>
            </div>
          </div>
        </>
      )}

      {editingUser && (
        <EditUserDialog
          key={editingUser.id}
          user={editingUser}
          open
          onOpenChange={(next) => {
            if (!next) setEditingUser(null);
          }}
        />
      )}
    </div>
  );
}
