import { Navigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { useAttendanceSettings } from './api';
import { WorkScheduleForm } from './components/work-schedule-form';
import { OfficeLocationsCard } from './components/office-locations-card';
import { TEXT } from './labels';
import { useCanConfigAttendance } from './use-can-config-attendance';

export function AttendanceSettingsPage() {
  // Chặn route với người không có quyền đọc (chỉ trải nghiệm; backend vẫn chặn).
  const { canReadConfig, canWriteConfig } = useCanConfigAttendance();
  // Không gọi API khi thiếu quyền đọc (tránh 403 vô ích); redirect xử lý ngay dưới.
  const { data, isPending, error, refetch } = useAttendanceSettings({ enabled: canReadConfig });

  if (!canReadConfig) return <Navigate to="/" replace />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{TEXT.pageTitle}</h1>
        <p className="text-sm text-muted-foreground">{TEXT.pageDescription}</p>
      </div>

      {!canWriteConfig && (
        <div
          role="status"
          className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground"
        >
          {TEXT.readOnlyBanner}
        </div>
      )}

      {isPending && <p className="text-muted-foreground">{TEXT.loading}</p>}

      {error && (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/50 p-4">
          <p className="text-sm text-destructive">
            {TEXT.loadError}: {error.message}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            {TEXT.retry}
          </Button>
        </div>
      )}

      {data && (
        <>
          <WorkScheduleForm settings={data} canWrite={canWriteConfig} />
          <OfficeLocationsCard locations={data.officeLocations} canWrite={canWriteConfig} />
        </>
      )}
    </div>
  );
}
