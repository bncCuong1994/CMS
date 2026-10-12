import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Plus } from 'lucide-react';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiError } from '@/lib/api';
import { useDepartments } from '@/lib/departments';
import { ROLE_LABELS } from '@/lib/labels';
import { useCreateUser } from './api';
import { RolePermissionsPreview } from './role-permissions-preview';
import { ASSIGNABLE_ROLES, createUserSchema, type CreateUserFormValues } from './schemas';
import { useCanCreateAdmin } from './use-can-create-admin';

const TEXT = {
  trigger: 'Tạo người dùng',
  title: 'Tạo người dùng',
  description: 'Tài khoản mới ở trạng thái Hoạt động và thuộc phòng ban được chọn.',
  cancel: 'Huỷ',
  submit: 'Tạo',
  submitting: 'Đang tạo...',
  success: 'Đã tạo người dùng',
  genericError: 'Không tạo được người dùng',
  departmentsLoading: 'Đang tải phòng ban...',
  departmentsEmpty: 'Không có phòng ban nào',
  departmentsError: 'Không tải được danh sách phòng ban',
  departmentPlaceholder: 'Chọn phòng ban',
  showPassword: 'Hiện mật khẩu',
  hidePassword: 'Ẩn mật khẩu',
} as const;

const DEFAULT_VALUES: CreateUserFormValues = {
  fullName: '',
  email: '',
  password: '',
  phone: '',
  position: '',
  departmentId: '',
  role: 'USER',
};

const CONFLICT_STATUS = 409;

export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const canCreateAdmin = useCanCreateAdmin();
  const createUser = useCreateUser();
  const departments = useDepartments({ enabled: open });

  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const role = form.watch('role');

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      form.reset(DEFAULT_VALUES);
      createUser.reset();
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await createUser.mutateAsync({
        email: values.email,
        fullName: values.fullName,
        password: values.password,
        departmentId: values.departmentId,
        role: values.role,
        ...(values.phone ? { phone: values.phone } : {}),
        ...(values.position ? { position: values.position } : {}),
      });
      toast.success(TEXT.success);
      handleOpenChange(false);
    } catch (error) {
      // AC6: email trùng → lỗi ngay dưới trường Email, popup giữ nguyên dữ liệu.
      if (error instanceof ApiError && error.status === CONFLICT_STATUS) {
        form.setError('email', { type: 'server', message: error.message });
        return;
      }
      toast.error(error instanceof Error ? error.message : TEXT.genericError);
    }
  });

  const roleOptions = ASSIGNABLE_ROLES.filter((r) => r !== 'ADMIN' || canCreateAdmin);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          {TEXT.trigger}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{TEXT.title}</DialogTitle>
          <DialogDescription>{TEXT.description}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField name="fullName" label="Họ tên" autoComplete="name" />
              <TextField name="email" label="Email" type="email" autoComplete="off" />
              <PasswordField />
              <TextField name="phone" label="Số điện thoại" optional autoComplete="off" />
              <TextField name="position" label="Chức danh" optional autoComplete="off" />

              <FormField
                name="departmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phòng ban</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={departments.isPending || !!departments.error}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={departments.isPending ? TEXT.departmentsLoading : TEXT.departmentPlaceholder}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(departments.data ?? []).map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
              <Button type="submit" disabled={form.formState.isSubmitting || createUser.isPending}>
                {createUser.isPending ? TEXT.submitting : TEXT.submit}
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
  type = 'text',
  optional = false,
  autoComplete,
}: {
  name: FieldPath<CreateUserFormValues>;
  label: string;
  type?: string;
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
            <Input type={type} autoComplete={autoComplete} {...field} value={field.value ?? ''} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function PasswordField() {
  const [visible, setVisible] = useState(false);
  return (
    <FormField
      name="password"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Mật khẩu</FormLabel>
          <div className="relative">
            <FormControl>
              <Input
                type={visible ? 'text' : 'password'}
                autoComplete="new-password"
                className="pr-10"
                {...field}
                value={field.value ?? ''}
              />
            </FormControl>
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? TEXT.hidePassword : TEXT.showPassword}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
