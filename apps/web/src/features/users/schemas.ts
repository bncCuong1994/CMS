import { ROLES } from '@cms/shared-types';
import { z } from 'zod';

/** Vai trò gán được khi tạo người dùng. `SUPER_ADMIN` không tạo qua API này. */
export const ASSIGNABLE_ROLES = [ROLES.ADMIN, ROLES.USER, ROLES.INTERN] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

const MIN_FULL_NAME = 2;
const MIN_PASSWORD = 8;
const MAX_PHONE = 20;

/** Khớp đúng bảng ràng buộc của `POST /users` trong US-USERS-01. */
export const createUserSchema = z.object({
  fullName: z.string().trim().min(MIN_FULL_NAME, `Họ tên tối thiểu ${MIN_FULL_NAME} ký tự`),
  email: z.string().trim().min(1, 'Vui lòng nhập email').pipe(z.email('Email không đúng định dạng')),
  password: z.string().min(MIN_PASSWORD, `Mật khẩu tối thiểu ${MIN_PASSWORD} ký tự`),
  phone: z
    .string()
    .trim()
    .max(MAX_PHONE, `Số điện thoại tối đa ${MAX_PHONE} ký tự`)
    .optional(),
  position: z.string().trim().optional(),
  departmentId: z.uuid('Vui lòng chọn phòng ban'),
  role: z.enum(ASSIGNABLE_ROLES, { error: 'Vui lòng chọn vai trò' }),
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;

/**
 * Form sửa người dùng (US-USERS-04). `phone`/`position` để trống nghĩa là xoá (gửi `null`).
 * `departmentIds` luôn yêu cầu ≥1 phòng (AC9) — đơn giản hoá: mọi người phải thuộc ít nhất một phòng.
 */
export const updateUserSchema = z.object({
  fullName: z.string().trim().min(MIN_FULL_NAME, `Họ tên tối thiểu ${MIN_FULL_NAME} ký tự`),
  phone: z
    .string()
    .trim()
    .max(MAX_PHONE, `Số điện thoại tối đa ${MAX_PHONE} ký tự`)
    .optional(),
  position: z.string().trim().optional(),
  departmentIds: z.array(z.uuid()).min(1, 'Chọn ít nhất một phòng ban'),
  role: z.enum(ASSIGNABLE_ROLES, { error: 'Vui lòng chọn vai trò' }),
});

export type UpdateUserFormValues = z.infer<typeof updateUserSchema>;
