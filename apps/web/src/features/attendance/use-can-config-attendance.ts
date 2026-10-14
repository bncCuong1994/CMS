import { PERMISSIONS } from '@cms/shared-types';
import { useMemo } from 'react';
import { useAuthStore } from '@/features/auth/auth-store';

export interface AttendanceConfigAccess {
  /** Thấy menu + vào được route (đọc). Super Admin/Admin/User; Intern không. */
  canReadConfig: boolean;
  /** Bật các thao tác ghi (Lưu/Thêm/Sửa/Xoá). Chỉ Super Admin. */
  canWriteConfig: boolean;
}

/**
 * Phân quyền màn Cấu hình chấm công, tách đọc/ghi (US-ATT-03, decisions.md 2026-10-14).
 *
 * Cố ý **không** dùng `hasPermission`: khi thiếu `departmentId`, `hasPermission` trả true nếu có
 * quyền ở *bất kỳ* phòng nào (decisions.md 2026-10-12). Cả hai quyền ở đây đều phạm vi **global**
 * (cấu hình singleton toàn công ty), nên kiểm thẳng `grants.global` để Admin phòng không lọt vào
 * nhầm ngữ cảnh. Đây chỉ là trải nghiệm — backend vẫn chặn ghi bằng `attendance.config` globalOnly.
 */
export function useCanConfigAttendance(): AttendanceConfigAccess {
  // Chọn thẳng mảng grants.global (ref ổn định) rồi suy ra cờ — tránh trả object mới mỗi lần
  // render khỏi selector của zustand (gây so sánh luôn khác → re-render vô hạn).
  const global = useAuthStore((s) => s.user?.grants.global);
  return useMemo(() => {
    const perms = global ?? [];
    const canWriteConfig = perms.includes(PERMISSIONS.ATTENDANCE_CONFIG);
    const canReadConfig = canWriteConfig || perms.includes(PERMISSIONS.ATTENDANCE_CONFIG_READ);
    return { canReadConfig, canWriteConfig };
  }, [global]);
}
