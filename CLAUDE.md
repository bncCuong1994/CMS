# Dự án CMS: rule chung cho mọi agent

## Bối cảnh
CMS quản lý người dùng, giao việc, theo dõi tiến độ, phân tích số liệu, phân quyền theo phòng ban.
Kế hoạch gốc: `docs/ke-hoach-kien-truc.md`. Quyết định đã chốt trong mục 9 của kế hoạch là cố định; muốn đổi phải ghi đề xuất vào `docs/decisions.md`, không tự đổi.

## Stack
pnpm workspace monorepo: `apps/api` (Node 22, NestJS 11, Prisma, PostgreSQL 17, pg-boss), `apps/web` (React 19, Vite, shadcn/ui, Tailwind 4, TanStack Query/Table, React Router 7), `packages/shared-types`.

## Thuật ngữ nghiệp vụ (dùng thống nhất trong code và tài liệu)
| Tiếng Việt | Code |
|---|---|
| Phòng ban (ngang cấp) | `department` |
| Loại công việc của phòng | `task_type` (trường tuỳ biến `custom_fields`, giá trị `custom_values`) |
| Vai trò | `SUPER_ADMIN`, `ADMIN`, `USER`, `INTERN` |
| Phạm vi | `global` \| `department` |
| Quyền | `<tài_nguyên>.<hành_động>`, vd `task.assign` |
| Trạng thái việc | `todo`, `in_progress`, `review`, `done`, `cancelled` |
| Độ ưu tiên | `low`, `medium`, `high`, `urgent` |
| Trạng thái tài khoản | `active`, `inactive`, `locked` (`locked_reason`: `manual`, `inactive_30d`) |

## Rule bất biến
1. Bảo mật nằm ở backend. FE ẩn/hiện chỉ để trải nghiệm.
2. Mọi endpoint nghiệp vụ kiểm tra cả **quyền** và **phạm vi phòng ban**. Admin không có quyền ở phòng không được gán.
3. Không truy vấn thẳng bảng của module khác; gọi qua service export.
4. Xoá mềm bằng `deleted_at`; truy vấn mặc định loại bản ghi đã xoá.
5. Hành động quan trọng ghi `activity_events` trong cùng transaction; thao tác quản trị ghi `audit_logs`.
6. Không commit secret. Cấu hình qua biến môi trường.
7. Không tắt, bỏ qua hay xoá test đang fail để cho qua.
8. Chỉ báo "xong" khi lint, test, build đã chạy thật và qua; kèm output khi báo.

## Lệnh
- `pnpm install`, `docker compose up -d db`
- `pnpm --filter api lint|test|test:e2e|build`, `pnpm --filter api prisma migrate dev --name <ten>`
- `pnpm --filter web lint|test|build`, `pnpm --filter web e2e`

## Git
Nhánh `feat/<module>-<mo-ta>`, `fix/...`. Commit theo Conventional Commits (`feat(tasks): ...`). Một PR một story.
