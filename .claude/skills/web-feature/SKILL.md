---
name: web-feature
description: Dựng một feature/màn hình trong apps/web theo chuẩn CMS (TanStack Query hooks, React Router 7, shadcn/ui Data Table, form react-hook-form + zod, trạng thái loading/rỗng/lỗi). Dùng khi thêm hoặc sửa màn hình.
---

# Feature frontend chuẩn

## Cấu trúc
```
src/features/tasks/
├─ api.ts          query keys + hooks
├─ schemas.ts      zod schema cho form
├─ components/     TaskTable.tsx, TaskForm.tsx, TaskKanban.tsx
└─ pages/          TaskListPage.tsx, TaskDetailPage.tsx
```

## api.ts
```ts
export const taskKeys = {
  all: ['tasks'] as const,
  list: (f: TaskFilters) => [...taskKeys.all, 'list', f] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
};
export const useTasks = (f: TaskFilters) =>
  useQuery({ queryKey: taskKeys.list(f), queryFn: () => api.get<Paged<TaskDto>>('/tasks', { params: f }), placeholderData: keepPreviousData });
export const useCreateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: CreateTaskInput) => api.post<TaskDto>('/tasks', b),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
};
```
Kiểu `TaskDto`, `Paged<T>` import từ `@cms/shared-types`. Không fetch trong `useEffect`.

## Trang danh sách
- Bộ lọc, trang, sắp xếp đồng bộ với URL (`useSearchParams`) để chia sẻ link được.
- Bảng dùng Data Table của shadcn (TanStack Table), phân trang phía server.
- Bắt buộc có 3 trạng thái: `<Skeleton>` khi tải, khối rỗng có hướng dẫn hành động, khối lỗi có nút thử lại. Lỗi 403 hiện thông báo "Bạn không có quyền".

## Form
```ts
const form = useForm<CreateTaskInput>({ resolver: zodResolver(createTaskSchema), defaultValues });
```
Dùng component `Form` của shadcn. Lỗi server `422/400` có `field` thì `form.setError(field, ...)`, còn lại hiện toast. Nút submit disable khi `isPending`.

## Giao diện
- Chỉ dùng token màu từ theme (`bg-background`, `text-muted-foreground`...), không hard-code màu hex.
- Icon lucide-react. Ngày giờ `Intl.DateTimeFormat('vi-VN')`.
- Văn bản giao diện tiếng Việt, gom ở một chỗ trong feature để dễ sửa.

## Checklist
- [ ] Route khai báo trong `src/app/router.tsx`, bọc quyền (skill permission-ui)
- [ ] Đủ loading/rỗng/lỗi
- [ ] Test Vitest cho form và component chính
- [ ] `pnpm --filter web lint && pnpm --filter web test && pnpm --filter web build` qua
