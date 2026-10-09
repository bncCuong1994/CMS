---
name: prisma-migration
description: Thay đổi schema Prisma, tạo migration và seed cho PostgreSQL 17 theo quy ước CMS (uuidv7, timestamptz, xoá mềm, chỉ mục, partition). Dùng khi thêm/sửa bảng, cột, chỉ mục hoặc dữ liệu seed.
---

# Schema và migration Prisma

## Quy ước model
```prisma
model Task {
  id            String    @id @default(dbgenerated("uuidv7()")) @db.Uuid
  departmentId  String    @map("department_id") @db.Uuid
  title         String
  status        TaskStatus @default(todo)
  customValues  Json?     @map("custom_values")
  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt     DateTime  @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt     DateTime? @map("deleted_at") @db.Timestamptz
  department    Department @relation(fields: [departmentId], references: [id])
  @@index([departmentId, status])
  @@map("tasks")
}
```
- Tên bảng/cột snake_case qua `@@map`/`@map`, field camelCase.
- `uuidv7()` có sẵn từ PostgreSQL 18; trên PostgreSQL 17 tạo hàm `uuidv7()` trong migration đầu tiên hoặc sinh ở ứng dụng. Ghi lựa chọn vào `docs/decisions.md`.
- Email dùng `citext` (bật extension trong migration đầu).
- CHECK constraint (progress 0-100, scope_type) và partial index (`tasks(due_date) WHERE status NOT IN ('done','cancelled')`) Prisma không biểu diễn được: tạo bằng `prisma migrate dev --create-only`, rồi thêm SQL tay vào file migration.
- `activity_events` partition theo tháng: tạo bằng SQL tay; job tạo sẵn partition tháng kế tiếp.

## Quy trình
1. Sửa `prisma/schema.prisma`.
2. `pnpm --filter api prisma migrate dev --create-only --name <mo_ta_ngan>`; đọc lại SQL sinh ra, bổ sung SQL tay nếu cần.
3. `pnpm --filter api prisma migrate dev` để áp dụng; `prisma generate`.
4. Kiểm migration chạy sạch trên DB mới: `prisma migrate reset --force` (chỉ DB dev/test).
5. Không bao giờ sửa migration đã merge; cần sửa thì tạo migration mới.
6. Migration xoá cột/bảng: tách 2 bước (ngừng dùng → xoá ở bản sau) và ghi rõ trong mô tả PR.

## Seed (`prisma/seed.ts`)
Idempotent (dùng `upsert`). Gồm: 4 vai trò hệ thống (`is_system = true`), toàn bộ mã quyền, ma trận role_permissions mặc định, 1 Super Admin lấy email/mật khẩu từ biến môi trường. Dữ liệu demo phòng ban/người dùng tách sang `seed-demo.ts`.
