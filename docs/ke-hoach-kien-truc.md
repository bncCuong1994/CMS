# Kế hoạch kiến trúc hệ thống CMS

Phạm vi: quản lý người dùng, giao việc, theo dõi tiến độ, phân tích số liệu người dùng, phân quyền theo phòng ban.
Công nghệ đã chốt: React 19 (FE), Node.js (BE), PostgreSQL, kiến trúc monolith.

> Các mục đánh dấu **[Mặc định]** là lựa chọn mình tạm đặt, cần bạn xác nhận hoặc sửa.

---

## 1. Tổng quan kiến trúc

Một ứng dụng **modular monolith**: một backend Node.js duy nhất, chia thành các module độc lập về nghiệp vụ, dùng chung một database PostgreSQL. Frontend React là SPA gọi REST API.

```
[Trình duyệt: React 19 SPA]
        │  HTTPS / REST (JSON) + JWT
        ▼
[Node.js monolith (NestJS)]
  ├─ auth          đăng nhập, refresh token, đổi mật khẩu
  ├─ users         CRUD người dùng, hồ sơ
  ├─ departments   phòng ban, thành viên, loại công việc riêng
  ├─ rbac          vai trò, quyền, kiểm tra quyền theo phạm vi
  ├─ projects      dự án/nhóm công việc
  ├─ tasks         giao việc, trạng thái, bình luận, file đính kèm
  ├─ progress      cập nhật tiến độ, lịch sử thay đổi
  ├─ notifications thông báo trong app (+ email sau)
  ├─ analytics     ghi sự kiện, tổng hợp số liệu, API báo cáo
  └─ audit         nhật ký thao tác
        │
        ▼
[PostgreSQL 17]   (+ job định kỳ chạy bằng pg-boss, không cần Redis)
```

Lý do chọn modular monolith: triển khai đơn giản (1 service + 1 DB), nhưng ranh giới module rõ ràng để sau này tách được nếu cần. Mỗi module chỉ gọi module khác qua service public của nó, không truy cập thẳng bảng của module khác.

## 2. Thư viện đề xuất

### Backend (Node.js 22 LTS, TypeScript)
| Mục đích | Thư viện |
|---|---|
| Framework | **NestJS 11** (module, DI, guard hợp với RBAC) **[Mặc định]**; thay thế: Express/Fastify thuần |
| ORM / migration | **Prisma** (schema rõ ràng, migration tự động) |
| Validate | class-validator + class-transformer (hoặc zod) |
| Auth | @nestjs/jwt, passport-jwt, **argon2** để băm mật khẩu |
| Job định kỳ | **pg-boss** (hàng đợi trên chính PostgreSQL) |
| Log | pino |
| Tài liệu API | @nestjs/swagger (OpenAPI) |
| Test | Jest + Supertest, Testcontainers cho PostgreSQL |

### Frontend (React 19, TypeScript, Vite)
| Mục đích | Thư viện |
|---|---|
| Build | Vite |
| Router | React Router 7 |
| Gọi API, cache | TanStack Query |
| State client | Zustand (chỉ cho state UI, phiên đăng nhập) |
| UI kit | **shadcn/ui + Tailwind CSS 4** (đã chốt): component copy thẳng vào code nên sửa giao diện tự do, đổi màu/theme chỉ bằng biến CSS |
| Bảng dữ liệu | TanStack Table (dùng với component Data Table của shadcn) |
| Icon | lucide-react |
| Form | react-hook-form + zod |
| Biểu đồ | Recharts |
| Kanban kéo thả | dnd-kit |
| Test | Vitest + Testing Library, Playwright cho E2E |

### Hạ tầng
Docker Compose cho môi trường dev (app + postgres). Một repo duy nhất (monorepo pnpm workspace) chứa cả `apps/api` và `apps/web`.

## 3. Phân quyền theo phòng ban (RBAC + phạm vi)

### 3.1 Phòng ban (đã chốt: ngang cấp)
Các phòng ban **ngang cấp**, không có phòng cha/con. Mỗi phòng có chức năng và loại công việc riêng, ví dụ:

| Phòng ban | Loại công việc mẫu |
|---|---|
| Marketing | Lên kế hoạch chiến dịch, viết content, chạy quảng cáo |
| Audio | Thu âm, mix, master |
| Video Editor | Dựng phim, color, xuất bản |

Để mỗi phòng có quy trình riêng mà không phải sửa code, mỗi phòng tự định nghĩa **loại công việc** (bảng `task_types`) kèm các trường riêng (ví dụ phòng Video có trường "độ dài video", "định dạng xuất"; phòng Audio có "số track"). Admin của phòng tự thêm/sửa loại công việc của phòng mình. Danh sách phòng ban cụ thể sẽ do Super Admin tạo trong hệ thống.

### 3.2 Vai trò (đã chốt)
| Vai trò | Phạm vi | Quyền |
|---|---|---|
| Super Admin | Toàn hệ thống | Mọi quyền: tạo/xoá phòng ban, tạo tài khoản ở mọi phòng, gán vai trò, xem báo cáo toàn công ty, xem nhật ký hệ thống |
| Admin | Phòng ban được gán | Quản lý thành viên phòng, tạo/giao việc trong phòng, quản lý loại công việc của phòng, xem báo cáo của phòng |
| User | Phòng ban của mình | Xem việc của phòng, tạo việc cho bản thân, cập nhật tiến độ việc được giao, bình luận, đính kèm file |
| Intern | Việc được giao cho mình | Chỉ xem và cập nhật tiến độ việc được giao, bình luận; không tạo/giao việc, không xem báo cáo |

**Admin nhiều phòng (đã chốt):** một Admin có thể được gán vào nhiều phòng ban và có đầy đủ quyền Admin ở tất cả các phòng đó (mỗi phòng là một dòng trong `user_roles`). Ví dụ Admin của cả Audio và Video thì giao việc, xem báo cáo ở cả hai phòng; ở phòng không được gán thì không có quyền gì.

**Vòng đời tài khoản Intern (đã chốt):**
- Khi được nhận chính thức: Admin hoặc Super Admin **chuyển vai trò Intern → User**, giữ nguyên lịch sử công việc. Thao tác được ghi vào nhật ký hệ thống.
- Admin hoặc Super Admin có thể **khoá thủ công** tài khoản Intern bất kỳ lúc nào.
- **Tự động khoá khi không hoạt động 30 ngày:** job chạy mỗi đêm kiểm tra Intern có lần hoạt động cuối (đăng nhập, cập nhật việc, bình luận) cách đây quá 30 ngày thì chuyển trạng thái sang `locked` với lý do `inactive_30d`, coi như loại bỏ. Admin của phòng nhận thông báo. Tài khoản bị khoá vẫn giữ dữ liệu, Super Admin có thể mở lại nếu cần.
- Quy tắc tự khoá chỉ áp dụng cho Intern, không áp dụng cho User/Admin.

### 3.3 Mô hình quyền
- Quyền dạng `tài_nguyên.hành_động`, ví dụ: `user.read`, `user.create`, `task.create`, `task.assign`, `task.update_own`, `task.update_any`, `task_type.manage`, `analytics.read`, `department.manage`, `role.manage`, `audit.read`.
- Vai trò = tập quyền (bảng `role_permissions`), 4 vai trò trên được seed sẵn, Super Admin có thể chỉnh quyền từng vai trò trên giao diện ma trận.
- Người dùng được gán vai trò **kèm phạm vi** (bảng `user_roles` có `scope_type`: `global` | `department` và `scope_id`). Super Admin dùng `global`, các vai trò còn lại dùng `department`.
- Kiểm tra quyền ở backend bằng Guard: `@RequirePermission('task.assign')` + hàm kiểm tra phạm vi (tài nguyên có thuộc phòng ban mà người dùng có quyền không). Frontend chỉ ẩn/hiện nút theo danh sách quyền trả về từ `/me/permissions`, không dùng để bảo mật.
- Quyền được cache trong token (danh sách mã quyền + phạm vi), thay đổi vai trò sẽ thu hồi refresh token để buộc cấp lại.

## 4. Thiết kế cơ sở dữ liệu

Quy ước: khoá chính `uuid` (uuidv7), cột `created_at`, `updated_at` kiểu `timestamptz`, xoá mềm bằng `deleted_at` cho các bảng nghiệp vụ.

### 4.1 Người dùng, phòng ban, phân quyền
```sql
departments (
  id uuid PK, name text, code text UNIQUE,
  description text,             -- chức năng, nhiệm vụ của phòng
  created_at, updated_at, deleted_at
)

users (
  id uuid PK, email citext UNIQUE, password_hash text,
  full_name text, phone text, avatar_url text,
  status text CHECK (status IN ('active','inactive','locked')),
  last_activity_at timestamptz, -- lần hoạt động cuối, dùng cho quy tắc khoá Intern
  locked_reason text NULL,      -- vd 'inactive_30d', 'manual'
  primary_department_id uuid FK -> departments,
  position text,                -- chức danh
  last_login_at timestamptz,
  created_at, updated_at, deleted_at
)

department_members (            -- một người có thể thuộc nhiều phòng
  department_id uuid FK, user_id uuid FK,
  joined_at timestamptz,
  PRIMARY KEY (department_id, user_id)
)

roles (id uuid PK, code text UNIQUE, name text, description text, is_system bool)
permissions (id uuid PK, code text UNIQUE, description text)
role_permissions (role_id FK, permission_id FK, PRIMARY KEY (role_id, permission_id))

user_roles (
  id uuid PK, user_id FK, role_id FK,
  scope_type text CHECK (scope_type IN ('global','department')),
  scope_id uuid NULL,           -- id phòng ban, NULL khi global
  granted_by uuid FK -> users, granted_at timestamptz,
  UNIQUE (user_id, role_id, scope_type, scope_id)
)

refresh_tokens (id uuid PK, user_id FK, token_hash text, expires_at, revoked_at, user_agent, ip inet)
```

### 4.2 Giao việc và tiến độ
```sql
projects (
  id uuid PK, name text, description text,
  department_id uuid FK,        -- phòng ban sở hữu
  owner_id uuid FK -> users,
  status text, start_date date, due_date date,
  created_at, updated_at, deleted_at
)

project_members (project_id FK, user_id FK, role_in_project text, PRIMARY KEY (project_id, user_id))

task_types (                    -- loại công việc riêng của từng phòng
  id uuid PK, department_id uuid FK, name text,
  custom_fields jsonb,          -- định nghĩa trường riêng: [{key, label, type, required}]
  default_estimate_hours numeric(6,2), is_active bool,
  created_at, updated_at
)

tasks (
  id uuid PK, project_id uuid FK NULL, department_id uuid FK,
  task_type_id uuid FK -> task_types NULL,
  custom_values jsonb,          -- giá trị các trường riêng theo task_type
  parent_task_id uuid FK -> tasks NULL,   -- việc con
  title text, description text,
  status text CHECK (status IN ('todo','in_progress','review','done','cancelled')),
  priority text CHECK (priority IN ('low','medium','high','urgent')),
  progress_percent smallint CHECK (progress_percent BETWEEN 0 AND 100),
  estimate_hours numeric(6,2),
  start_date date, due_date date, completed_at timestamptz,
  created_by uuid FK -> users,
  created_at, updated_at, deleted_at
)

task_assignees (task_id FK, user_id FK, assigned_by FK, assigned_at, PRIMARY KEY (task_id, user_id))

task_progress_logs (            -- lịch sử cập nhật tiến độ
  id uuid PK, task_id FK, user_id FK,
  from_status text, to_status text,
  from_percent smallint, to_percent smallint,
  hours_spent numeric(6,2), note text, created_at
)

task_comments (id uuid PK, task_id FK, user_id FK, content text, created_at, updated_at, deleted_at)
task_attachments (id uuid PK, task_id FK, uploaded_by FK, file_name, mime_type, size_bytes, storage_key, created_at)

notifications (id uuid PK, user_id FK, type text, payload jsonb, read_at timestamptz NULL, created_at)
```

Chỉ mục chính: `tasks(department_id, status)`, `tasks(due_date) WHERE status NOT IN ('done','cancelled')`, `task_assignees(user_id)`, `task_progress_logs(task_id, created_at)`, `notifications(user_id, read_at)`.

### 4.3 Nhật ký và phân tích
```sql
audit_logs (
  id bigserial PK, actor_id uuid, action text,      -- vd 'user.update'
  entity_type text, entity_id uuid,
  before jsonb, after jsonb, ip inet, created_at
)

activity_events (               -- sự kiện thô cho analytics
  id bigserial PK, user_id uuid, department_id uuid,
  event_type text,              -- login, task_created, task_completed, page_view...
  entity_id uuid NULL, metadata jsonb, occurred_at timestamptz
)  -- phân vùng (partition) theo tháng

daily_user_stats (             -- bảng tổng hợp, job chạy mỗi đêm
  stat_date date, user_id uuid, department_id uuid,
  logins int, active_minutes int,
  tasks_created int, tasks_completed int, tasks_completed_on_time int,
  tasks_overdue int, hours_logged numeric(8,2),
  PRIMARY KEY (stat_date, user_id)
)

daily_department_stats (stat_date, department_id, active_users, tasks_open, tasks_completed,
  on_time_rate numeric(5,2), avg_cycle_hours numeric(8,2), PRIMARY KEY (stat_date, department_id))
```

## 5. Phân tích số liệu người dùng

### 5.1 Chỉ số theo dõi (đã chốt: giữ cả 3 nhóm)
**Hoạt động người dùng**
- DAU / WAU / MAU (số người dùng hoạt động theo ngày/tuần/tháng), theo phòng ban
- Số lần đăng nhập, người dùng không hoạt động quá 30 ngày
- Người dùng mới theo tháng

**Hiệu suất công việc**
- Số việc được giao, đang làm, hoàn thành, quá hạn (theo người, phòng ban, dự án)
- Tỷ lệ hoàn thành đúng hạn
- Thời gian hoàn thành trung bình (từ lúc giao đến `done`)
- Khối lượng việc hiện tại mỗi người (số việc mở, tổng giờ ước tính) để cân bằng tải
- Tổng giờ đã ghi nhận

**Tiến độ dự án**
- % hoàn thành dự án (bình quân có trọng số theo giờ ước tính)
- Biểu đồ burndown theo ngày

### 5.2 Cách tính
1. Mỗi hành động quan trọng ghi một dòng vào `activity_events` (trong cùng transaction với thao tác nghiệp vụ).
2. Job pg-boss chạy 00:30 mỗi đêm tổng hợp vào `daily_user_stats` và `daily_department_stats`, đồng thời khoá các tài khoản Intern không hoạt động quá 30 ngày.
3. Số liệu "hôm nay" tính trực tiếp từ bảng gốc; số liệu lịch sử đọc từ bảng tổng hợp, nên dashboard nhanh mà không cần công cụ ngoài.
4. API báo cáo tôn trọng phân quyền: Admin chỉ thấy phòng mình, Super Admin thấy toàn công ty, User chỉ thấy số liệu của bản thân, Intern không có báo cáo.
5. Xuất Excel/CSV cho từng báo cáo.

## 6. Cấu trúc thư mục

```
cms/
├─ apps/
│  ├─ api/                         # Node.js (NestJS)
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma
│  │  │  ├─ migrations/
│  │  │  └─ seed.ts                # phòng ban, vai trò, quyền mặc định, Super Admin
│  │  ├─ src/
│  │  │  ├─ main.ts
│  │  │  ├─ app.module.ts
│  │  │  ├─ common/                # guard, decorator, filter, pagination, logger
│  │  │  ├─ config/
│  │  │  └─ modules/
│  │  │     ├─ auth/
│  │  │     ├─ users/
│  │  │     ├─ departments/
│  │  │     ├─ rbac/
│  │  │     ├─ projects/
│  │  │     ├─ tasks/
│  │  │     ├─ progress/
│  │  │     ├─ notifications/
│  │  │     ├─ analytics/
│  │  │     └─ audit/
│  │  │        (mỗi module: *.controller.ts, *.service.ts, dto/, *.spec.ts)
│  │  └─ test/                     # e2e
│  └─ web/                         # React 19 + Vite
│     └─ src/
│        ├─ app/                   # router, providers, layout
│        ├─ features/
│        │  ├─ auth/
│        │  ├─ users/
│        │  ├─ departments/
│        │  ├─ roles/
│        │  ├─ projects/
│        │  ├─ tasks/              # danh sách, kanban, chi tiết việc
│        │  └─ dashboard/          # biểu đồ phân tích
│        ├─ shared/                # api client, hooks, components dùng chung, Can (kiểm tra quyền)
│        └─ main.tsx
├─ packages/
│  └─ shared-types/                # kiểu DTO, mã quyền dùng chung FE/BE
├─ docker-compose.yml
├─ pnpm-workspace.yaml
└─ README.md
```

## 7. Các màn hình chính
1. Đăng nhập, quên mật khẩu
2. Dashboard: thẻ KPI, biểu đồ hoạt động, việc quá hạn của tôi/phòng tôi
3. Người dùng: danh sách, lọc theo phòng ban/trạng thái, tạo/sửa, gán vai trò
4. Phòng ban: danh sách phòng, thành viên, Admin của phòng, loại công việc của phòng
5. Vai trò và quyền: ma trận vai trò × quyền
6. Dự án: danh sách, thành viên, tiến độ
7. Công việc: dạng bảng và kanban, chi tiết việc (người nhận, tiến độ, bình luận, file, lịch sử)
8. Báo cáo: theo người, phòng ban, dự án, xuất Excel
9. Nhật ký hệ thống (chỉ Super Admin)

## 8. Lộ trình đề xuất
| Giai đoạn | Nội dung |
|---|---|
| 1. Nền tảng | Monorepo, Docker, Prisma schema, auth JWT, seed dữ liệu |
| 2. Người dùng & phân quyền | users, departments, rbac, màn hình quản trị |
| 3. Công việc | projects, tasks, giao việc, kanban, cập nhật tiến độ, thông báo |
| 4. Phân tích | activity_events, job tổng hợp, dashboard, xuất báo cáo |
| 5. Hoàn thiện | audit log, test E2E, tối ưu, hướng dẫn triển khai |

## 9. Các quyết định đã chốt
Đã chốt: phòng ban ngang cấp, 4 vai trò (Super Admin, Admin, User, Intern), Admin có thể ở nhiều phòng, Intern được chuyển thành User hoặc bị khoá (tự khoá sau 30 ngày không hoạt động), backend NestJS + Prisma, frontend shadcn/ui + Tailwind, giữ cả 3 nhóm chỉ số ở mục 5.1.

Không còn điểm nào chờ xác nhận. Bước tiếp theo: dựng khung code (giai đoạn 1).
