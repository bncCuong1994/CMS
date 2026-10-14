import type {
  AttendanceSettings,
  CreateOfficeLocationRequest,
  OfficeLocation,
  UpdateAttendanceSettingsRequest,
  UpdateOfficeLocationRequest,
} from '@cms/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const attendanceKeys = {
  all: ['attendance'] as const,
  settings: ['attendance', 'settings'] as const,
};

/** `GET /attendance/settings` — chưa cấu hình thì backend trả bộ mặc định (AC1). */
export function useAttendanceSettings(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: attendanceKeys.settings,
    queryFn: () => api.get<AttendanceSettings>('/attendance/settings'),
    enabled: options.enabled ?? true,
  });
}

/** `PATCH /attendance/settings` — lưu lịch làm việc (AC2). */
export function useUpdateAttendanceSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateAttendanceSettingsRequest) =>
      api.patch<AttendanceSettings>('/attendance/settings', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: attendanceKeys.settings }),
    meta: { skipErrorToast: true },
  });
}

/** `POST /attendance/office-locations` — thêm điểm (AC3). */
export function useCreateOfficeLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOfficeLocationRequest) =>
      api.post<OfficeLocation>('/attendance/office-locations', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: attendanceKeys.settings }),
    meta: { skipErrorToast: true },
  });
}

/** `PATCH /attendance/office-locations/:id` — sửa điểm (AC4). */
export function useUpdateOfficeLocation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateOfficeLocationRequest) =>
      api.patch<OfficeLocation>(`/attendance/office-locations/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: attendanceKeys.settings }),
    meta: { skipErrorToast: true },
  });
}

/** `DELETE /attendance/office-locations/:id` — xoá mềm (AC5). */
export function useDeleteOfficeLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/attendance/office-locations/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: attendanceKeys.settings }),
    meta: { skipErrorToast: true },
  });
}
