# CMS

Hệ thống quản lý người dùng, giao việc, theo dõi tiến độ và phân tích số liệu theo phòng ban.
Kế hoạch kiến trúc: [docs/ke-hoach-kien-truc.md](docs/ke-hoach-kien-truc.md).

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `apps/api` | Backend NestJS 11 + Prisma + PostgreSQL |
| `apps/web` | Frontend React 19 + Vite + shadcn/ui + Tailwind 4 |
| `packages/shared-types` | Mã quyền, vai trò, kiểu dữ liệu dùng chung |

## Chạy trên máy

Cần Node 22, pnpm 10 và Docker.

```bash
pnpm install
docker compose up -d db

cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm --filter api prisma migrate deploy
pnpm db:seed

pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:3000/api/v1, tài liệu Swagger: http://localhost:3000/api/docs
- Tài khoản Super Admin mặc định: `admin@cms.local` / `Admin@123` (đổi trong `apps/api/.env` trước khi seed)

Seed tạo 4 vai trò (Super Admin, Admin, User, Intern), các quyền mặc định và 3 phòng ban mẫu (Marketing, Audio, Video Editor).

## Kiểm tra

```bash
pnpm -r lint
pnpm -r build
pnpm -r test
# e2e xoá sạch dữ liệu, chỉ chạy trên database tên có chữ "test"
DATABASE_URL=postgresql://cms:cms@localhost:5432/cms_test pnpm --filter api test:e2e
```
