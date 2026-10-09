import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/features/auth/auth-store';

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Xin chào, {user?.fullName}</h1>
        <p className="text-muted-foreground">Số liệu tổng quan sẽ có ở giai đoạn 4.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {['Việc đang làm', 'Việc quá hạn', 'Tỷ lệ đúng hạn'].map((title) => (
          <Card key={title}>
            <CardHeader>
              <CardDescription>{title}</CardDescription>
              <CardTitle className="text-3xl">–</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Chưa có dữ liệu</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
