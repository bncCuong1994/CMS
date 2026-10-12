# Test case module `users`

Story: `docs/stories/users/US-USERS-01.md` (TEST-01, phần BE)
Tự động hoá: `apps/api/test/users-create.e2e-spec.ts` (Jest + Supertest + Testcontainers PostgreSQL 17)
Fixture: `apps/api/test/fixtures/actors.ts` — 3 phòng ngang cấp (Marketing, Audio, Video Editor), 7 tài khoản, token lấy bằng đăng nhập thật qua `POST /api/v1/auth/login`.
Chạy: `pnpm --filter api test:e2e`

## TC-users-01 Ma trận phân quyền `POST /api/v1/users`

Loại: API. Tiền điều kiện: DB test sạch + `seedWorld`. Mỗi ca dùng email riêng; ca bị chặn còn kiểm `users`, `department_members`, `user_roles`, `audit_logs` không tăng dòng nào.

| # | Người gọi | Vai trò tạo | Phòng đích | Mong đợi | Thực tế |
|---|---|---|---|---|---|
| 1 | Super Admin | USER | Audio | 201 | 201 pass |
| 2 | Super Admin | USER | Marketing | 201 | 201 pass |
| 3 | Super Admin | INTERN | Video Editor | 201 | 201 pass |
| 4 | Super Admin | ADMIN | Marketing | 201 | 201 pass |
| 5 | Admin (Audio) | USER | Audio | 201 | 201 pass |
| 6 | Admin (Audio) | INTERN | Audio | 201 | 201 pass |
| 7 | **Admin (Audio)** | USER | **Marketing** | **403** | 403 pass |
| 8 | Admin (Audio) | USER | Video Editor | 403 | 403 pass |
| 9 | **Admin (Audio)** | **ADMIN** | Audio | **403** | 403 pass |
| 10 | Admin (Audio + Video) | USER | Audio | 201 | 201 pass |
| 11 | Admin (Audio + Video) | USER | Video Editor | 201 | 201 pass |
| 12 | Admin (Audio + Video) | USER | Marketing | 403 | 403 pass |
| 13 | Admin (Audio + Video) | ADMIN | Video Editor | 403 | 403 pass |
| 14 | **User (Marketing)** | USER | Marketing | **403** (không phải 401) | 403 pass |
| 15 | User (Marketing) | USER | Audio | 403 | 403 pass |
| 16 | User (Marketing) | ADMIN | Marketing | 403 | 403 pass |
| 17 | **Intern (Video)** | USER | Video Editor | **403** | 403 pass |
| 18 | Intern (Video) | INTERN | Video Editor | 403 | 403 pass |
| 19 | Intern (Video) | ADMIN | Video Editor | 403 | 403 pass |
| 20 | Chưa đăng nhập | USER | Audio | 401 | 401 pass |
| 21 | Chưa đăng nhập | ADMIN | Audio | 401 | 401 pass |

Ca 14 và 17 kiểm thêm: token được xác nhận còn hiệu lực bằng `GET /auth/me` → 200 trước khi gọi `POST /users`, để chứng minh 403 đến từ phân quyền chứ không phải token hết hạn.

## TC-users-02 Ca phân quyền bắt buộc theo story

| # | Ca | Mong đợi | Thực tế |
|---|---|---|---|
| 1 | Admin Audio gửi `departmentId` của Marketing | 403, message chứa "Không có quyền", không tạo bản ghi nào | pass |
| 2 | Admin tạo vai trò `ADMIN` | 403 "Chỉ Super Admin được tạo tài khoản Admin", không tạo bản ghi nào | pass |
| 3 | User có access token hợp lệ | 403, khác 401 | pass |
| 4 | Intern có access token hợp lệ | 403, khác 401 | pass |
| 5 | Không có token | 401 | pass |
| 6 | Token không phải JWT / chữ ký sai | 401 | pass |

## TC-users-03 Ca nghiệp vụ

| # | Ca | Mong đợi | Thực tế |
|---|---|---|---|
| 1 | Email trùng | 409 "Email đã được sử dụng", không ghi gì | pass |
| 2 | Email trùng khác hoa/thường | 409 | pass |
| 3 | `departmentId` không tồn tại | 404 "Không tìm thấy phòng ban" | pass |
| 4 | `departmentId` đã xoá mềm (`deleted_at != null`) | 404 | pass |
| 5 | `email` sai định dạng | 400, message nêu `email` | pass |
| 6 | `password` < 8 ký tự | 400, message nêu `password` | pass |
| 7 | Thiếu `fullName` | 400, message nêu `fullName` | pass |
| 8 | `fullName` < 2 ký tự | 400 | pass |
| 9 | `role = SUPER_ADMIN` | 400 | pass |
| 10 | `departmentId` không phải uuid | 400 | pass |
| 11 | Trường lạ trong body (`status`) | 400 (whitelist) | pass |

Lưu ý thứ tự: guard quyền chạy **trước** `ValidationPipe`, nên các ca 400 phải gọi bằng Super Admin — Admin sẽ nhận 403 trước khi tới bước validate.

## TC-users-04 Tạo thành công ghi đúng dữ liệu

| # | Kiểm tra | Mong đợi | Thực tế |
|---|---|---|---|
| 1 | Response 201 | đúng `{ id, email, fullName, status: 'active' }`, không có `phone` | pass |
| 2 | `users` | `phone`, `position` đúng, `status='active'`, `deleted_at=null` | pass |
| 3 | `department_members` | đúng 1 dòng, phòng đã chọn | pass |
| 4 | `user_roles` | đúng 1 dòng, `scope_type='department'`, `scope_id` = phòng đã chọn, `granted_by` = người gọi | pass |
| 5 | `audit_logs` | **đúng một** dòng `action='user.create'`, `entity_type='user'`, `actor_id` = người gọi, `after` khớp email/role/departmentId | pass |
| 6 | Admin tạo Intern trong phòng mình | `scope_id` = phòng của Admin, `actor_id` = Admin | pass |
| 7 | Email lưu lowercase | pass | pass |
| 8 | Mật khẩu | không plaintext trong response lẫn trong bảng `users`; hash `$argon2`; `argon2.verify` đúng | pass |
| 9 | Tài khoản mới đăng nhập được | 200 với mật khẩu đã đặt, 401 với mật khẩu khác | pass |
