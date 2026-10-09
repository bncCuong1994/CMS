import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/labels';

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  position: string | null;
  status: 'active' | 'inactive' | 'locked';
  lastLoginAt: string | null;
  departments: { id: string; name: string }[];
  roles: { role: string; departmentId: string | null }[];
}

const STATUS: Record<UserRow['status'], { label: string; variant: 'secondary' | 'outline' | 'destructive' }> = {
  active: { label: 'Hoạt động', variant: 'secondary' },
  inactive: { label: 'Ngừng', variant: 'outline' },
  locked: { label: 'Đã khoá', variant: 'destructive' },
};

export function UsersPage() {
  const { data, isPending, error } = useQuery({ queryKey: ['users'], queryFn: () => api<UserRow[]>('/users') });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Người dùng</h1>
      {isPending && <p className="text-muted-foreground">Đang tải...</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      {data && (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Họ tên</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phòng ban</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Đăng nhập gần nhất</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.fullName}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.departments.map((d) => d.name).join(', ') || '–'}</TableCell>
                  <TableCell>{[...new Set(u.roles.map((r) => ROLE_LABELS[r.role] ?? r.role))].join(', ')}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS[u.status].variant}>{STATUS[u.status].label}</Badge>
                  </TableCell>
                  <TableCell>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('vi-VN') : '–'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
