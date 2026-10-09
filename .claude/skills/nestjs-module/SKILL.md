---
name: nestjs-module
description: Tạo hoặc mở rộng module NestJS trong apps/api theo chuẩn dự án CMS (controller, service, DTO, guard quyền, Swagger, test). Dùng khi thêm endpoint hoặc module nghiệp vụ mới.
---

# Module NestJS chuẩn

## Cấu trúc
```
src/modules/tasks/
├─ tasks.module.ts
├─ tasks.controller.ts
├─ tasks.service.ts
├─ dto/ create-task.dto.ts, update-task.dto.ts, task-query.dto.ts
├─ tasks.service.spec.ts
test/tasks.e2e-spec.ts
```
Export service nào module khác cần dùng trong `exports` của module. Không import PrismaService của module khác để truy vấn bảng không thuộc mình.

## Controller
```ts
@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Post()
  @RequirePermission('task.create')
  @ApiCreatedResponse({ type: TaskDto })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTaskDto) {
    return this.tasks.create(user, dto);
  }

  @Get()
  @RequirePermission('task.read')
  list(@CurrentUser() user: AuthUser, @Query() q: TaskQueryDto) {
    return this.tasks.list(user, q);
  }
}
```
Controller mỏng: không có logic nghiệp vụ, không gọi Prisma.

## Service
```ts
async create(user: AuthUser, dto: CreateTaskDto) {
  await this.scope.assertDepartment(user, 'task.create', dto.departmentId); // skill rbac-scope
  return this.prisma.$transaction(async (tx) => {
    const task = await tx.task.create({ data: { ...map(dto), createdById: user.id } });
    await this.events.record(tx, { userId: user.id, departmentId: dto.departmentId, eventType: 'task_created', entityId: task.id });
    return toTaskDto(task);
  });
}
```
- Mọi `findMany`/`findFirst` thêm `deletedAt: null`.
- Danh sách trả `{ data, meta: { page, pageSize, total } }`, `pageSize` tối đa 100.
- Ném lỗi bằng `AppException(code, httpStatus, message)` để filter trả `{ statusCode, code, message }`.

## DTO
```ts
export class CreateTaskDto {
  @IsString() @Length(1, 200) title!: string;
  @IsUUID() departmentId!: string;
  @IsOptional() @IsUUID() taskTypeId?: string;
  @IsEnum(TaskPriority) priority: TaskPriority = 'medium';
  @IsOptional() @IsObject() customValues?: Record<string, unknown>;
}
```
`ValidationPipe` toàn cục với `whitelist: true, forbidNonWhitelisted: true, transform: true`. Kiểu response dùng chung đặt ở `packages/shared-types`.

## Checklist trước khi báo xong
- [ ] Mỗi route có `@RequirePermission` và kiểm phạm vi trong service
- [ ] Ghi `activity_events`/`audit_logs` đúng story
- [ ] Swagger decorator đủ
- [ ] Unit test service + e2e có ca 200, 401, 403 (Admin phòng khác), 404, 400
- [ ] `pnpm --filter api lint && pnpm --filter api test && pnpm --filter api test:e2e && pnpm --filter api build` qua
