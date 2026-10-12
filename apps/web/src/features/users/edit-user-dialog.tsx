import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, type FieldPath } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiError } from '@/lib/api';
import { useDepartments } from '@/lib/departments';
import { ROLE_LABELS } from '@/lib/labels';
import { useUpdateUser, type UpdateUserBody, type UserRow } from './api';
import { MultiSelectFilter } from './multi-select-filter';
import { RolePermissionsPreview } from './role-permissions-preview';
import { ASSIGNABLE_ROLES, updateUserSchema, type AssignableRole, type UpdateUserFormValues } from './schemas';
import { useCanCreateAdmin } from './use-can-create-admin';

const TEXT = {
  title: 'Sửa người dùng',
  description: 'Cập nhật thông tin, phòng ban và vai trò. Email không đổi ở màn này.',
  cancel: 'Huỷ',
  submit: 'Lưu',
  submitting: 'Đang lưu...',
  success: 'Đã cập nhật người dùng',
  genericError: 'Không cập nhật được người dùng',
  departmentsLoading: 'Đang tải phòng ban...',
  departmentsEmpty: 'Không có phòng ban nào',
  departmentsError: 'Không tải được danh sách phòng ban',
  departmentsLabel: 'Phòng ban',
} as const;

const FORBIDDEN_STATUS = 403;
const NOT_FOUND_STATUS = 404;

interface EditUserDialogProps {
  user: UserRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Vai trò assignable duy nhất của user hiện tại (bỏ qua vai trò theo phòng trùng lặp). */
function currentRole(user: UserRow): AssignableRole {
  const found = user.roles
    .map((r) => r.role)
    .find((role): role is AssignableRole => (ASSIGNABLE_ROLES as readonly string[]).includes(role));
  return found ?? 'USER';
}

function toDefaultValues(user: UserRow): UpdateUserFormValues {
  return {
    fullName: user.fullName,
    phone: user.phone ?? '',
    position: user.position ?? '',
    departmentIds: user.departments.map((d) => d.id),
    role: currentRole(user),
  };
}

/**
 * PATCH bán phần: `phone`/`position` để trống nghĩa là gửi `null` (xoá). `role` và
 * `departmentIds` luôn gửi — BE tự áp thuật toán phạm vi (Admin chỉ chạm phòng mình quản lý).
 */
function toBody(values: UpdateUserFormValues): UpdateUserBody {
  return {
    fullName: values.fullName,
    phone: values.phone ? values.phone : null,
    position: values.position ? values.position : null,
    departmentIds: values.departmentIds,
    role: values.role,
  };
}

export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
  const canAssignAdmin = useCanCreateAdmin();
  const updateUser = useUpdateUser(user.id);
  const departments = useDepartments({ enabled: open });

  const form = useForm<UpdateUserFormValues>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: toDefaultValues(user),
  });
  const role = form.watch('role');

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      form.reset(toDefaultValues(user));
      updateUser.reset();
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await updateUser.mutateAsync(toBody(values));
      toast.success(TEXT.success);
      handleOpenChange(false);
    } catch (error) {
      // AC6/AC7/AC8: 403 ngoài phạm vi / nâng ADMIN; AC thiếu: 404 không còn người dùng.
      // Giữ dialog mở, hiện thông báo lỗi để người dùng chỉnh lại.
      if (error instanceof ApiError && (error.status === FORBIDDEN_STATUS || error.status === NOT_FOUND_STATUS)) {
        toast.error(error.message);
        return;
      }
      toast.error(error instanceof Error ? error.message : TEXT.genericError);
    }
  });

  // AC6: ẩn lựa chọn ADMIN nếu không có `role.manage` global. Giữ ADMIN nếu người đang
  // sửa vốn đã là ADMIN để không làm biến mất giá trị hiện tại khỏi dropdown.
  const roleOptions = ASSIGNABLE_ROLES.filter(
    (r) => r !== 'ADMIN' || canAssignAdmin || user.roles.some((ur) => ur.role === 'ADMIN'),
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{TEXT.title}</DialogTitle>
          <DialogDescription>{TEXT.description}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField name="fullName" label="Họ tên" autoComplete="name" />
              <TextField name="phone" label="Số điện thoại" optional autoComplete="off" />
              <TextField name="position" label="Chức danh" optional autoComplete="off" />

              <FormField
                name="departmentIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{TEXT.departmentsLabel}</FormLabel>
                    <MultiSelectFilter
                      name="edit-department"
                      label={TEXT.departmentsLabel}
                      hideLabel
                      options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
                      value={field.value}
                      onChange={field.onChange}
                    />
                    {departments.error && (
                      <p className="text-sm text-destructive">
                        {TEXT.departmentsError}: {departments.error.message}
                      </p>
                    )}
                    {!departments.isPending && !departments.error && departments.data?.length === 0 && (
                      <p className="text-sm text-muted-foreground">{TEXT.departmentsEmpty}</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vai trò</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roleOptions.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <RolePermissionsPreview role={role} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                {TEXT.cancel}
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting || updateUser.isPending}>
                {updateUser.isPending ? TEXT.submitting : TEXT.submit}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function TextField({
  name,
  label,
  optional = false,
  autoComplete,
}: {
  name: FieldPath<UpdateUserFormValues>;
  label: string;
  optional?: boolean;
  autoComplete?: string;
}) {
  return (
    <FormField
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            {optional && <span className="text-xs font-normal text-muted-foreground"> (không bắt buộc)</span>}
          </FormLabel>
          <FormControl>
            <Input autoComplete={autoComplete} {...field} value={typeof field.value === 'string' ? field.value : ''} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
