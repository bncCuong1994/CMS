import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDepartments } from '@/lib/departments';

export function DepartmentsPage() {
  const { data, isPending, error } = useDepartments();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Phòng ban</h1>
      {isPending && <p className="text-muted-foreground">Đang tải...</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((d) => (
          <Card key={d.id}>
            <CardHeader>
              <CardTitle>{d.name}</CardTitle>
              <CardDescription>{d.description ?? d.code}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{d.memberCount} thành viên</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
