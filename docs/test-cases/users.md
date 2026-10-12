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

---

# Test case module `users` — US-USERS-03 (tìm kiếm, lọc, cột chức danh, phân trang)

Story: `docs/stories/users/US-USERS-03.md` (TEST-01)
Tự động hoá BE: `apps/api/test/users-list.e2e-spec.ts` (Jest + Supertest + Testcontainers PostgreSQL 17)
Tự động hoá FE: `apps/web/src/features/users/users-page.test.tsx` (Vitest + Testing Library)
Chạy: `pnpm --filter api test:e2e` và `pnpm --filter web test`

## TC-users-05 Envelope & phân trang `GET /api/v1/users` (BE)

| # | Ca | Mong đợi | Thực tế |
|---|---|---|---|
| 1 | Hình dạng response | `{ data: [], meta: { total, page, pageSize } }`; mặc định page=1, pageSize=20 | pass |
| 2 | Mỗi dòng đủ trường | id/email/fullName/position/status/departments/roles; không rò `passwordHash` | pass |
| 3 | `page=2&pageSize=5` | `data.length=5`, `meta={total,page:2,pageSize:5}`, không trùng trang 1 | pass |
| 4 | Gộp mọi trang | Set id gộp = `meta.total` (không trùng), trang cuối trả đúng phần dư | pass |
| 5 | `pageSize=1000` | `meta.pageSize=100`, không 400, data ≤ 100 dòng | pass |

## TC-users-06 Tìm kiếm `q` (ILIKE contains, insensitive) (BE)

| # | Ca | Mong đợi | Thực tế |
|---|---|---|---|
| 1 | `q`=một phần fullName | chỉ người khớp tên/email | pass |
| 2 | `q`=một phần email | chỉ người khớp email | pass |
| 3 | `q` chữ HOA khớp tên thường | vẫn khớp (insensitive) | pass |
| 4 | `q` chỉ khoảng trắng | bỏ qua, total như không có q | pass |
| 5 | `q` không khớp ai | data rỗng, total 0 | pass |

## TC-users-07 Lọc chọn nhiều `role`/`status`/`departmentId` — OR trong 1 bộ lọc, AND giữa các bộ lọc (BE)

Hợp đồng: mỗi bộ lọc nhận **mảng**, chấp nhận cả phẩy-ngăn-cách (`?role=USER,INTERN`) lẫn lặp tham số (`?role=USER&role=INTERN`); chuẩn hoá về `string[]`; mảng rỗng → bỏ lọc. Trong một bộ lọc = OR (`in`); giữa các bộ lọc và với `q` = AND.

| # | Ca | Mong đợi | Thực tế |
|---|---|---|---|
| 1 | `role=INTERN` (một giá trị dạng mảng) | chỉ người có vai trò INTERN | pass |
| 2 | `role=USER,INTERN` (OR) | trả hợp USER ∪ INTERN; `meta.total` = count(USER∪INTERN); KHÔNG trả ADMIN thuần | pass |
| 3 | `role` lặp tham số `?role=USER&role=INTERN` | cùng tập id + cùng `total` với dạng phẩy | pass |
| 4 | `status=active,locked` (OR) | trả hợp active ∪ locked; KHÔNG trả inactive | pass |
| 5 | `status=locked` (một giá trị) | chỉ người bị khoá | pass |
| 6 | `departmentId=Audio,Video` (OR) | trả hợp người của cả hai phòng; `meta.total` = count(Audio∪Video); không có Marketing | pass |
| 7 | `departmentId=VIDEO` (một giá trị) | chỉ người phòng Video | pass |
| 8 | `role=INTERN,USER` + `departmentId=VIDEO` (AND) | chỉ người Video có vai trò INTERN hoặc USER; userMarketing bị loại | pass |
| 9 | `role=INTERN` + `status=locked` (AND) | giao — Intern bị khoá; internVideo (active) bị loại | pass |
| 10 | `q` + `role` lệch nhau (AND) | tên khớp nhưng role không ∈ tập → loại; thuộc `role=USER,INTERN` thì xuất hiện | pass |

## TC-users-08 Phạm vi phòng ban là AND với mọi filter — CRITICAL (BE)

| # | Người gọi | Thao tác | Mong đợi | Thực tế |
|---|---|---|---|---|
| 1 | Admin Audio | `q` khớp người phòng Marketing | KHÔNG lộ người phòng khác; mọi dòng thuộc Audio | pass |
| 2 | Admin Audio | `GET /users` mặc định | không thấy người Marketing/Video | pass |
| 3 | Admin Audio | `departmentId=Marketing` | **403**, không rò email/data | pass |
| 4 | Admin Audio | `departmentId=Video` (chưa gán) | **403** | pass |
| 5 | Admin Audio | `departmentId=Audio,Video` (mảng, 1 id ngoài phạm vi) | **403** — bất kỳ id ngoài phạm vi; không rò data | pass |
| 6 | Admin Audio+Video | `departmentId=Audio,Marketing` (mảng, Marketing ngoài phạm vi) | **403** | pass |
| 7 | Admin Audio+Video | `departmentId=Audio,Video` (cả hai được gán) | 200, mọi dòng ∈ Audio ∪ Video | pass |
| 8 | Admin Audio+Video | `departmentId=Video` / `=Marketing` | 200 / **403** | pass |
| 9 | Admin Audio+Video | `GET /users` | thấy Audio+Video, không thấy Marketing | pass |
| 10 | User Marketing | `GET /users` | chỉ người cùng phòng Marketing | pass |

## TC-users-09 Ma trận vào endpoint `GET /api/v1/users` (BE)

| # | Người gọi | Mong đợi | Thực tế |
|---|---|---|---|
| 1 | Super Admin | 200 | pass |
| 2 | Admin Audio | 200 | pass |
| 3 | Admin Audio+Video | 200 | pass |
| 4 | User Marketing | 200 | pass |
| 5 | Intern Video (token hợp lệ, `/auth/me`=200) | **403** (không 401), không rò data | pass |
| 6 | Chưa đăng nhập | 401 | pass |
| 7 | Token chữ ký sai | 401 | pass |

## TC-users-10 Validate query (BE)

| # | Ca | Mong đợi | Thực tế |
|---|---|---|---|
| 1 | `status` ngoài enum | 400 | pass |
| 2 | `role` ngoài enum | 400 | pass |
| 3 | `role=USER,GHOST` (một phần tử mảng sai enum) | 400 | pass |
| 4 | `status=active,bogus` (một phần tử mảng sai enum) | 400 | pass |
| 5 | `page` không phải số | 400 | pass |
| 6 | `departmentId` không phải uuid | 400 | pass |
| 7 | `departmentId=<uuid>,khong-phai-uuid` (một phần tử mảng sai uuid) | 400 | pass |

## TC-users-11 Màn Người dùng — tìm/lọc chọn nhiều/cột/phân trang (FE, AC1–AC5)

Bộ lọc là `MultiSelectFilter` (popover + checkbox, không còn Radix Select). FE serialize mảng thành **phẩy-ngăn-cách, giá trị đã sort tăng dần**, một param mỗi bộ lọc; bộ lọc rỗng thì không gửi param.

| # | Ca | Mong đợi | Thực tế |
|---|---|---|---|
| 1 | Render `position` | cột Chức danh hiển thị đúng | pass |
| 2 | `position` rỗng | hiện `–` | pass |
| 3 | Gõ ô tìm kiếm (debounce) | gọi `/users` với `params.q` đúng | pass |
| 4 | Tick một Vai trò (popover) | `params.role='INTERN'`, `params.page=1` | pass |
| 5 | Tick nhiều Vai trò (Intern + User) | `params.role='INTERN,USER'` (phẩy, đã sort), `page=1` | pass |
| 6 | Tick hai bộ lọc khác nhau (Vai trò + Trạng thái) | cả `params.role` và `params.status` cùng xuất hiện | pass |
| 7 | Tick nhiều Trạng thái (Hoạt động + Đã khoá) | `params.status='active,locked'` (phẩy, đã sort) | pass |
| 8 | Tick một Phòng ban | `params.departmentId` = id phòng | pass |
| 9 | Tick nhiều Phòng ban | `params.departmentId` = hai id nối phẩy, đã sort | pass |
| 10 | Bỏ chọn hết một bộ lọc | param đó biến mất khỏi request | pass |
| 11 | Đổi bộ lọc khi đang ở trang 2 | `params.page` reset về 1 | pass |
| 12 | Bấm "Sau" | `params.page=2` | pass |
| 13 | Rỗng do lọc | "Không tìm thấy người dùng phù hợp." | pass |
| 14 | Rỗng thật | "Chưa có người dùng nào." | pass |

Lưu ý: TC-users-08 là ca chống rò dữ liệu ngoài phạm vi — kiểm **nội dung** trả về, không chỉ mã HTTP.

---

# US-USERS-04 Sửa thông tin người dùng — `PATCH /api/v1/users/:id`

Tự động hoá BE: `apps/api/test/users-update.e2e-spec.ts` (Jest + Supertest + Testcontainers, Postgres 17 thật).
Tự động hoá FE: `apps/web/src/features/users/edit-user-dialog.test.tsx` (Vitest + Testing Library).
Lệnh: `pnpm --filter api test:e2e -- users-update.e2e-spec.ts`; `pnpm --filter web test`.
Kết quả lần chạy 2026-10-12 (commit nhánh `feat/web-axios-client`): BE 35/35 pass, FE 9/9 pass. Toàn bộ e2e api 139/139, toàn bộ vitest web 97/97.

## TC-users-12 Ma trận phân quyền PATCH (BE, AC2 / Ca phân quyền)

Người bị sửa được seed thật theo phòng + vai trò; ca bị chặn khẳng định bản ghi (user + department_members + user_roles) **không đổi**.

| # | Người gọi | Người bị sửa | Mong đợi | Thực tế |
|---|---|---|---|---|
| 1 | Super Admin | USER phòng Audio | 200 | pass |
| 2 | Super Admin | USER phòng Marketing | 200 | pass |
| 3 | Super Admin | INTERN phòng Video | 200 | pass |
| 4 | Admin Audio | USER phòng Audio | 200 | pass |
| 5 | Admin Audio | INTERN phòng Audio | 200 | pass |
| 6 | Admin Audio | USER phòng Marketing | **403** (ngoài phạm vi) | pass |
| 7 | Admin Audio | INTERN phòng Video | **403** (ngoài phạm vi) | pass |
| 8 | Admin Audio+Video | USER phòng Audio | 200 | pass |
| 9 | Admin Audio+Video | INTERN phòng Video | 200 | pass |
| 10 | Admin Audio+Video | USER phòng Marketing | **403** | pass |
| 11 | User Marketing (token hợp lệ) | USER phòng Marketing | **403** (không 401) | pass |
| 12 | User Marketing | USER phòng Audio | **403** | pass |
| 13 | Intern Video (token hợp lệ) | INTERN phòng Video | **403** (không 401) | pass |
| 14 | Intern Video | USER phòng Audio | **403** | pass |
| 15 | Chưa đăng nhập | USER phòng Audio | 401 | pass |

## TC-users-13 Ca phân quyền bắt buộc theo story (BE)

| # | Ca | Mong đợi | Thực tế |
|---|---|---|---|
| 1 | AC7 — Admin Audio PATCH người chỉ thuộc Marketing | 403 `Không có quyền...`, bản ghi không đổi | pass |
| 2 | AC6 — Admin đặt `role=ADMIN` | 403 "Chỉ Super Admin được gán vai trò Admin", không đổi | pass |
| 3 | Admin sửa một `ADMIN` | 403 "Chỉ Super Admin được gán vai trò Admin", không đổi | pass |
| 4 | AC8 — Admin Audio gửi `departmentIds` chứa phòng Video | 403 `Không có quyền gán phòng ban này`, phòng ngoài phạm vi giữ nguyên | pass |
| 5 | User token hợp lệ (`/auth/me`=200) PATCH | 403 (khẳng định không 401) | pass |
| 6 | Intern token hợp lệ (`/auth/me`=200) PATCH | 403 (khẳng định không 401) | pass |
| 7 | Không token | 401 | pass |

## TC-users-14 Thuật toán gán phòng (BE — phần dễ sai nhất)

Ký hiệu: `D_target` phòng hiện tại, `D_admin` phòng người gọi quản lý, `D_req` = `departmentIds` gửi lên.

| # | Ca | D_target | Người gọi (D_admin) | D_req | Tập phòng mới mong đợi | Thực tế |
|---|---|---|---|---|---|---|
| 1 | Admin gỡ khỏi phòng mình, giữ phòng ngoài | {Audio, Marketing} | Admin Audio ({Audio}) | `[]` | {Marketing} | pass |
| 2 | Admin nhiều phòng ghi đè phần trong phạm vi | {Audio, Video, Marketing} | Admin Audio+Video | {Video} | {Marketing, Video} | pass |
| 3 | AC4 — Super Admin thay toàn bộ | {Marketing} | Super Admin (all) | {Audio, Video} | {Audio, Video}, `user_roles` đồng bộ (USER mỗi phòng) | pass |

## TC-users-15 Đổi vai trò thu hồi phiên + giữ lịch sử (BE, AC5)

| # | Ca | Mong đợi | Thực tế |
|---|---|---|---|
| 1 | INTERN → USER | `refresh_tokens.revoked_at` của người đó được set; refresh token cũ gọi `/auth/refresh` → 401; vai trò phòng đổi thành USER | pass |
| 2 | Đổi vai trò giữ lịch sử | `activity_events` của người đó không bị xoá (số dòng trước = sau) | pass |
| 3 | Chỉ đổi thông tin cơ bản (không đổi vai trò/phòng) | refresh token **không** bị thu hồi | pass |

Ghi chú: dự án chưa có bảng `tasks`; "lịch sử công việc" được kiểm gián tiếp qua `activity_events` của chính người bị sửa (không bị xoá). Khi module tasks có, bổ sung ca khẳng định các dòng task/log còn nguyên.

## TC-users-16 Ghi audit_logs (BE, AC3)

| # | Ca | Mong đợi | Thực tế |
|---|---|---|---|
| 1 | Sửa họ tên + chức danh | đúng 1 dòng `action='user.update'`, `actorId` = người gọi, `before`/`after` chứa trường đã đổi | pass |

## TC-users-17 Validate & không tìm thấy (BE)

| # | Ca | Mong đợi | Thực tế |
|---|---|---|---|
| 1 | `fullName` < 2 ký tự | 400 (message chứa `fullName`), bản ghi không đổi | pass |
| 2 | Trường lạ (`email`) trong body | 400 (whitelist) | pass |
| 3 | `role=SUPER_ADMIN` | 400 | pass |
| 4 | User không tồn tại | 404 "Không tìm thấy người dùng" | pass |
| 5 | User đã xoá mềm | 404 "Không tìm thấy người dùng" | pass |
| 6 | `departmentIds` chứa phòng không tồn tại | 404 "Không tìm thấy phòng ban", bản ghi không đổi | pass |

## TC-users-18 Form sửa (FE, AC1/AC2/AC3/AC6/AC9)

| # | Ca | Mong đợi | Thực tế |
|---|---|---|---|
| 1 | AC2 — vai trò User | nút "Sửa" ẩn trên dòng | pass |
| 2 | AC2 — vai trò Intern | nút "Sửa" ẩn trên dòng | pass |
| 3 | AC2 — Admin có `user.update` ở phòng của dòng | nút "Sửa" hiện | pass |
| 4 | AC1 — mở form | điền sẵn họ tên, SĐT, chức danh, phòng ban (nút "Phòng ban (1)"), vai trò | pass |
| 5 | AC9 — `fullName` < 2 ký tự | lỗi "Họ tên tối thiểu 2 ký tự", không gọi PATCH | pass |
| 6 | AC9 — gỡ hết phòng ban (Super Admin) | lỗi "Chọn ít nhất một phòng ban", không gọi PATCH | pass |
| 7 | AC6 — Admin phòng (role.manage ở phạm vi phòng) | dropdown vai trò **không** có lựa chọn Admin (chỉ User/Intern) | pass |
| 8 | AC6 — Super Admin (role.manage global) | dropdown vai trò có lựa chọn Admin | pass |
| 9 | AC3 — sửa hợp lệ | PATCH đúng body (`phone`/`position`/`departmentIds`/`role`), toast "Đã cập nhật người dùng", đóng dialog | pass |

Không phát hiện lỗi mới ở US-USERS-04 (BE-01/FE-01). Mọi ô khớp kỳ vọng của story.
