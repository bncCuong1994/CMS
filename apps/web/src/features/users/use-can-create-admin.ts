import { PERMISSIONS } from '@cms/shared-types';
import { useAuthStore } from '@/features/auth/auth-store';

/**
 * Chỉ người có `role.manage` ở phạm vi **global** mới tạo được tài khoản `ADMIN` (AC8),
 * đúng như `UsersService.create` ở backend kiểm tra.
 *
 * Cố ý **không** dùng `usePermission(PERMISSIONS.ROLE_MANAGE)`: `hasPermission` khi thiếu
 * `departmentId` trả về true nếu có quyền ở *bất kỳ* phòng nào, nên Admin phòng sẽ lọt.
 * Đây chỉ là trải nghiệm — backend vẫn chặn.
 */
export function useCanCreateAdmin(): boolean {
  return useAuthStore((s) => s.user?.grants.global.includes(PERMISSIONS.ROLE_MANAGE) ?? false);
}
