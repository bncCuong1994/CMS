# Backlog

Thứ tự làm theo giai đoạn trong `docs/ke-hoach-kien-truc.md`. **Không kéo việc giai đoạn sau lên khi nền tảng chưa xong.**

Trạng thái: `Chưa làm` → `Đang làm` → `Chờ review` → `Xong`

## Giai đoạn 1 — Nền tảng

| Mã | Tiêu đề | Trạng thái | Ghi chú |
|---|---|---|---|
| — | Dựng khung monorepo, API NestJS, web React, phân quyền cơ bản | Xong | commit `efa3172`, PR #2 |
| `US-WEB-01` | Gọi API bằng axios và xử lý lỗi tập trung ở web | **Chờ merge** | FE-01 `5e88c4d` → review REQUEST_CHANGES → sửa 7 mục `f503230` → TEST-01 `2f281af`. Nhánh `feat/web-axios-client` (tách từ `feat/users-create-user`, chưa push). Kiểm chứng 2026-10-12 (tôi tự chạy): web `lint` xanh / `test` **74/74** / `build` xanh. 14/15 AC có test bảo đảm; AC15 (không log secret) chỉ kiểm được bằng review + grep, không test được bằng jsdom. **Chặn `US-USERS-02`** — cùng sửa `features/users/api.ts`. |

## Giai đoạn 2 — Người dùng & phân quyền

| Mã | Tiêu đề | Trạng thái | Ghi chú |
|---|---|---|---|
| `US-USERS-01` | Tạo tài khoản người dùng từ màn Người dùng | **Chờ merge** | BE-01, FE-01, TEST-01 xong; review đã xử lý hết góp ý MEDIUM/LOW. Nhánh `feat/users-create-user`, chưa commit. Kiểm chứng 2026-10-12: api `lint`/`lint:test`/`test` 9/9/`test:e2e` **57/57**/`build`, web `lint`/`test` **16/16**/`build` — tất cả xanh. |
| `US-USERS-02` | Chuẩn hoá kiểu request/response module users vào shared-types | Chưa làm | Nợ kỹ thuật. **Chặn:** phải sau khi `US-USERS-01` merge và test TEST-01 xanh, **và sau `US-WEB-01`** (cùng sửa `apps/web/src/features/users/api.ts`). |
| `US-USERS-03` | Tìm kiếm, lọc và cột chức danh ở bảng Người dùng | **Chờ merge** | Search tên/email + lọc vai trò/trạng thái/phòng (**chọn nhiều**, OR trong bộ lọc / AND giữa các bộ lọc) + cột Chức danh + **phân trang** (trả nợ pagination). Đổi hợp đồng `GET /users` → envelope `{ data, meta }` + query mảng (breaking). BE+FE+Test xong, review ĐẠT (không CRITICAL/HIGH). Kiểm chứng 2026-10-12 qua subagent: `api lint`/`build` xanh + `test:e2e` **104/104**; `web lint`/`build` xanh + `test` **88/88**. Làm trên nhánh `feat/web-axios-client` (chồng lên US-WEB-01, chưa commit) — **sẽ phải rebase** khi US-WEB-01/US-USERS-01/02 merge. Story: `docs/stories/users/US-USERS-03.md`. |
| `US-USERS-04` | Sửa thông tin người dùng (gồm gán nhiều phòng + đổi vai trò) | **Code xong — CHỜ TEST** | `PATCH /users/:id` + `UsersService.update` + dialog/nút "Sửa" đã nối đủ BE+FE. **Review ĐẠT** (APPROVE, không CRITICAL/HIGH) 2026-10-12: phạm vi theo target đúng, thuật toán gán phòng giữ phòng ngoài phạm vi, chặn leo thang ADMIN, thu hồi token trong transaction, chỉ `audit_logs`. api+web **lint/build xanh**. **CÒN THIẾU: TEST-01** (BE e2e ma trận phân quyền + thuật toán phòng + revoke token; FE dialog/validate) — hoãn sang phiên sau theo quyết định người dùng (chi phí phiên cao). Góp ý minor + giới hạn hạ-cấp-SUPER_ADMIN đã ghi trong story. Story: `docs/stories/users/US-USERS-04.md`. |
| `US-USERS-05` | Khoá / mở khoá / xoá tài khoản | Chưa làm | `POST /users/:id/lock`+`/unlock` + `DELETE /users/:id` (xoá mềm, giải phóng email). **Thêm quyền mới `user.delete`** (seed + migration). Admin mở được cả `inactive_30d`; chỉ Super Admin xử lý Admin; không tự xoá mình. **Thứ tự:** sau `US-USERS-04`. Story: `docs/stories/users/US-USERS-05.md`. |

### Việc còn treo của `US-USERS-01`

| Việc | Trạng thái |
|---|---|
| Thêm bước `pnpm --filter api --if-present run lint:test` vào `.github/workflows/ci.yml` (giữa bước `Lint` và `Typecheck và build`, kèm `if: steps.src.outputs.present == 'true'`) | **Chưa làm** — hook `guard-paths.mjs` chặn cả `be-dev` và `ba-pm` sửa `.github/`. Cần người dùng sửa tay hoặc cấp quyền. Không có bước này thì `test/` vẫn không được typecheck trên CI. |

### Chưa viết story (đã nhận diện, chờ xếp thứ tự)

| Việc | Vì sao cần | Độ ưu tiên |
|---|---|---|
| ~~Sửa thông tin người dùng (gồm **gán nhiều phòng ban**)~~ → **đã thành `US-USERS-04`** | `US-USERS-01` cố ý chỉ gán một phòng khi tạo; kế hoạch cho phép Admin thuộc nhiều phòng | Cao |
| ~~Khoá / mở khoá tài khoản thủ công (`locked_reason = 'manual'`)~~ → **đã thành `US-USERS-05`** (kèm xoá mềm) | Nghiệp vụ cốt lõi, chưa có endpoint | Cao |
| Chuyển Intern → User giữ nguyên lịch sử | Nghiệp vụ cốt lõi. **Phần lớn gộp vào `US-USERS-04`** (đổi vai trò giữ lịch sử); giữ dòng này cho ca "nhận chính thức" nếu cần luồng riêng | Cao |
| Job tự khoá Intern sau 30 ngày không hoạt động + thông báo Admin phòng | Cần `activity_events` ghi đủ trước | Cao |
| Màn ma trận quyền cho Super Admin | Khi có màn này thì quyền xem trước trong popup tạo người dùng **phải** đổi từ `DEFAULT_ROLES` sang `GET /roles` (xem `docs/decisions.md`) | Trung bình |
| Nợ kỹ thuật: `DepartmentRow` ở `apps/web/src/features/departments/departments-page.tsx:5` khai kiểu cục bộ | Cùng loại lỗi với `US-USERS-02` nhưng thuộc module `departments`; cố ý tách để một PR không đụng hai module | Trung bình |
| ~~**Phân trang `GET /api/v1/users`**~~ → **gộp vào `US-USERS-03`** (`users.service.ts:37-44` dùng `findMany` không `take`/`skip`) | Có từ giai đoạn 1. Bảng lớn sẽ kéo cả bộ về client. Phát hiện khi review `US-USERS-01`. | Cao |
| ~~**Email của user đã xoá mềm không tái dùng được**~~ → **gộp vào `US-USERS-05`** (giải phóng email khi xoá mềm; người dùng đã chốt phương án giải phóng) | Admin xoá người rồi tạo lại cùng email sẽ nhận `409`. Chốt: khi xoá mềm đổi email sang `<email>+deleted-<id>` và `create` loại `deletedAt` khi kiểm trùng. | Cao |
| **Envelope lỗi chuẩn ở backend**: trả thêm `code` máy đọc được (`USER_EMAIL_TAKEN`, `FORBIDDEN_SCOPE`...) thay vì chỉ `{ statusCode, message, error }` mặc định của NestJS | Phát hiện khi viết `US-WEB-01`: FE phải **suy ra `code` từ HTTP status**, nên hai lỗi 409 khác nhau về nghiệp vụ thì FE không phân biệt được mà không so khớp chuỗi tiếng Việt. Đổi là thay hợp đồng của mọi endpoint → cần story riêng có BE + test e2e. | Trung bình |
| Luồng đặt mật khẩu qua email thay vì người tạo tự đặt | Cần SMTP; hiện là nợ đã ghi trong `decisions.md` | Thấp, chờ hạ tầng |

## Giai đoạn 3 — Công việc

Chưa viết story. Phụ thuộc giai đoạn 2 xong: `task_types` + `custom_fields` theo phòng ban, giao việc, trạng thái, độ ưu tiên.

## Giai đoạn 4 — Phân tích

Chưa viết story. Ba nhóm chỉ số: hoạt động người dùng, hiệu suất công việc, tiến độ dự án. Phạm vi xem báo cáo: Super Admin toàn công ty, Admin phòng mình, User chỉ bản thân, Intern không có.

## Giai đoạn 5 — Hoàn thiện

| Việc | Vì sao cần |
|---|---|
| **Siết `app.e2e-spec.ts`**: nó assert `auditLog.count({ action: 'user.create' }) === 1` trên **toàn bảng** (có từ giai đoạn 1). Hiện xanh nhờ mỗi file tự `TRUNCATE` + `--runInBand`, nhưng sẽ vỡ khi thêm spec mới chạy song song. Đổi thành đếm theo `entityId`. | Test giòn, dễ đỏ oan và làm mất niềm tin vào suite |
| Thêm **ESLint + Prettier** cho `apps/web` và `apps/api` | `lint` của web hiện chỉ là `tsc -b --noEmit` → checklist style (đặt tên, độ dài hàm, lồng sâu) không có máy kiểm, chỉ dựa review người |
| Code-split bundle web | Build cảnh báo chunk 670 kB > 500 kB |
