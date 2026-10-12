# US-USERS-05 Khoá, mở khoá và xoá tài khoản

Vai trò: Super Admin | Admin
Là Super Admin hoặc Admin, tôi muốn khoá/mở khoá và xoá (mềm) tài khoản để quản lý vòng đời nhân sự và loại bỏ người đã nghỉ.
Module: users
Giai đoạn: 2
Quyền cần: `user.lock` (khoá/mở khoá), `user.delete` (xoá — **quyền mới, phải thêm**)  Phạm vi: `global` (Super Admin) | `department` (Admin)

## Bối cảnh

- Chưa có endpoint khoá/mở/xoá. Quyền `user.lock` đã seed (Admin có). **`user.delete` CHƯA tồn tại** trong `permissions.ts`/seed → phải thêm.
- Trạng thái tài khoản: `active` | `inactive` | `locked`; `locked_reason`: `manual` | `inactive_30d` (CLAUDE.md, kế hoạch 3.2).
- Xoá mềm bằng `deleted_at` (rule bất biến #4). Job đêm tự khoá Intern `inactive_30d` là story giai đoạn sau; ở đây là **khoá/mở thủ công** (`manual`) và **mở** tài khoản đã bị khoá (gồm cả `inactive_30d`).

## Quyết định thiết kế (đã chốt với người dùng 2026-10-12)

1. Làm **cả hai** action: khoá/mở khoá **và** xoá.
2. Xoá = **xoá mềm** (`deleted_at`).
3. **Chỉ Super Admin** xoá/khoá được tài khoản `ADMIN`. Admin chỉ xoá/khoá `USER`/`INTERN` trong phòng mình.
4. **Không ai tự xoá chính mình** (Admin và Super Admin). (Áp dụng tương tự cho tự-khoá để tránh tự loại mình khỏi hệ thống — xem giả định 3.)
5. Xoá thì **giải phóng email** để có thể tạo lại người dùng cùng email đó.
6. Admin phòng **được** mở khoá tài khoản loại `inactive_30d` (không chỉ Super Admin) — mở rộng so với câu chữ kế hoạch, ghi vào `decisions.md`.

## Giả định (ghi rõ để dễ đổi)

1. **Không xoá được `SUPER_ADMIN`** qua endpoint này (bảo vệ tài khoản cấp cao); cũng không khoá `SUPER_ADMIN`.
2. **Giải phóng email**: khi xoá mềm, đổi `email` của bản ghi bị xoá thành dạng không đụng unique, ví dụ `"<email>+deleted-<userId>"`, để email gốc tạo lại được. Đồng thời sửa `UsersService.create` dùng điều kiện loại `deletedAt` khi kiểm trùng (giải quyết luôn nợ "email đã xoá mềm không tái dùng được" trong backlog).
3. **Không tự khoá chính mình**: chặn `lock` khi `:id` = người gọi (tránh tự nhốt). Mở khoá chính mình vô nghĩa (đang active) nên không cần xử lý riêng.
4. **Khoá/xoá thu hồi phiên**: set `revoked_at` cho refresh token của người bị khoá/xoá; access token hết hạn ngắn nên không cần blacklist.
5. Xoá người đang là thành viên/được giao việc: giữ dữ liệu (xoá mềm), không xoá cascade task/log.

## Tiêu chí nghiệm thu (Given/When/Then)

### AC1 — Khoá thủ công
- **Given** tôi có `user.lock`, đang xem một `USER` active trong phòng mình
- **When** tôi bấm "Khoá" và xác nhận
- **Then** API `200`, `status='locked'`, `locked_reason='manual'`, refresh token của người đó bị thu hồi
- **And** `audit_logs` ghi `action='user.lock'`; bảng refresh, badge chuyển "Đã khoá"

### AC2 — Mở khoá (gồm inactive_30d)
- **Given** một tài khoản đang `locked` (lý do `manual` **hoặc** `inactive_30d`) trong phòng tôi
- **When** tôi bấm "Mở khoá"
- **Then** API `200`, `status='active'`, `locked_reason=null`; `audit_logs` ghi `action='user.unlock'`

### AC3 — Xoá mềm + giải phóng email
- **Given** tôi có `user.delete`, đang xem một `USER` trong phòng mình
- **When** tôi bấm "Xoá" và xác nhận ở hộp thoại cảnh báo
- **Then** API `200/204`, `deleted_at` được set, người đó biến mất khỏi `GET /users`; refresh token bị thu hồi
- **And** email gốc dùng lại được: tạo mới người dùng cùng email → `201`, không còn `409`
- **And** `audit_logs` ghi `action='user.delete'`

### AC4 — Không tự xoá chính mình
- **Given** tôi là Admin (hoặc Super Admin)
- **When** tôi gọi `DELETE /users/<chính tôi>`
- **Then** API `403` "Không thể xoá chính mình", không thay đổi bản ghi

### AC5 — Chỉ Super Admin xử lý Admin
- **Given** tôi là Admin
- **When** tôi khoá hoặc xoá một tài khoản `ADMIN`
- **Then** API `403` "Chỉ Super Admin được thao tác tài khoản Admin"

### AC6 — Admin không thao tác ngoài phạm vi
- **Given** tôi là Admin phòng Audio
- **When** tôi khoá/xoá một người chỉ thuộc phòng Marketing
- **Then** API `403`, không thay đổi bản ghi

### AC7 — Nút theo quyền
- **Given** tôi là User/Intern
- **Then** không thấy nút Khoá/Mở/Xoá (`Can` với `user.lock`/`user.delete`). Backend vẫn chặn.

### AC8 — Xác nhận trước khi xoá
- **Given** tôi bấm "Xoá"
- **Then** hiện hộp thoại xác nhận nêu rõ hậu quả trước khi gọi API (thao tác có thể khôi phục bởi DB nhưng không có nút undo ở UI)

## Ca phân quyền

| Vai trò | Khoá/mở/xoá `USER`/`INTERN` phòng mình | Thao tác người phòng KHÁC | Thao tác một `ADMIN` | Tự xoá mình |
|---|---|---|---|---|
| **Super Admin** (`global`) | ✅ | ✅ mọi phòng | ✅ | ❌ **403** |
| **Admin** (phòng được gán) | ✅ | ❌ **403** | ❌ **403** | ❌ **403** |
| **Admin ở phòng KHÔNG được gán** | — | ❌ **403** | ❌ **403** | ❌ **403** |
| **User** | ❌ **403** | ❌ **403** | ❌ **403** | ❌ **403** |
| **Intern** | ❌ **403** | ❌ **403** | ❌ **403** | ❌ **403** |

Ca bắt buộc có test: **Admin Audio xoá người Marketing → 403**; **Admin xoá/khoá một ADMIN → 403**; **Admin tự xoá mình → 403**; **xoá rồi tạo lại cùng email → 201**; **User token hợp lệ gọi → 403** (không 401).

## API contract

### `POST /api/v1/users/:id/lock`
- Quyền `user.lock` + phạm vi theo phòng của target. Chặn tự-khoá, chặn target `ADMIN`/`SUPER_ADMIN` (trừ Super Admin với Admin).
- **Response `200`**: user sau khi khoá (`USER_SELECT`), `status='locked'`, `locked_reason='manual'`.

### `POST /api/v1/users/:id/unlock`
- Quyền `user.lock` + phạm vi. Mở cả `manual` và `inactive_30d`.
- **Response `200`**: `status='active'`, `locked_reason=null`.

### `DELETE /api/v1/users/:id`
- Quyền `user.delete` + phạm vi. Chặn tự xoá, chặn xoá `SUPER_ADMIN`; chỉ Super Admin xoá `ADMIN`.
- Xoá mềm: set `deleted_at`, đổi `email` sang dạng giải phóng, thu hồi refresh token, ghi audit.
- **Response `200`** (trả `{ id, deletedAt }`) hoặc `204`.

**Mã lỗi (chung)**

| Mã | Khi nào | Thông báo |
|---|---|---|
| `401` | không/sai token | `Unauthorized` |
| `403` | thiếu quyền; ngoài phạm vi; thao tác Admin mà không phải Super Admin; tự xoá mình; xoá Super Admin | `Không có quyền...` / `Chỉ Super Admin được thao tác tài khoản Admin` / `Không thể xoá chính mình` |
| `404` | user không tồn tại/đã xoá mềm | `Không tìm thấy người dùng` |
| `409` | (unlock) tài khoản không ở trạng thái `locked` | `Tài khoản không bị khoá` |

## Phụ thuộc
- **Thêm quyền `user.delete`**: sửa `packages/shared-types/src/permissions.ts` (`USER_DELETE: 'user.delete'` + mô tả), thêm `P.USER_DELETE` vào vai trò `ADMIN` trong `roles.ts`, chạy lại seed + migration để chèn `permissions` và `role_permissions`. Super Admin tự có qua `ALL_PERMISSIONS`.
- Service auth thu hồi refresh token theo `userId` (rule bất biến #3: gọi qua service, không truy vấn thẳng bảng module khác).
- **Thứ tự:** sau US-USERS-03 và US-USERS-04 (nhạy cảm nhất, cùng chạm `api.ts`/bảng).

## Task

### BE-01 — Thêm quyền `user.delete` + endpoint lock/unlock/delete
- Shared-types + seed + migration cho `user.delete` (gán Admin).
- 3 endpoint với guard `user.lock`/`user.delete`; kiểm phạm vi theo phòng của target trong service; chặn tự xoá, chặn thao tác Admin/Super Admin theo quy tắc.
- Mỗi thao tác trong transaction: đổi trạng thái/`deleted_at`/giải phóng email; thu hồi refresh token qua auth service; ghi `audit_logs` (`user.lock`/`user.unlock`/`user.delete` với `before`/`after`).
- Sửa `UsersService.create` kiểm trùng email **loại** bản ghi `deletedAt != null` (hoặc dựa vào email đã đổi khi xoá) để email tái dùng được.

### FE-01 — Menu thao tác mỗi dòng
- Cột thao tác / menu "…": Khoá | Mở khoá | Xoá, ẩn/hiện theo trạng thái hiện tại và quyền (`user.lock`/`user.delete`), ẩn với người bị cấm theo quy tắc (tự mình, ADMIN khi không phải Super Admin).
- Hộp thoại xác nhận cho Khoá và Xoá (AlertDialog); `useMutation` cho từng action; thành công → `invalidateQueries(['users'])` + toast; lỗi → toast/thông báo, không đổi bảng.

### TEST-01 — Kiểm thử
- **BE (e2e):** ma trận 4 vai trò cho cả 3 action; Admin thao tác phòng khác → 403; Admin xử lý ADMIN → 403; tự xoá → 403; mở khoá `inactive_30d` → 200; **xoá rồi tạo lại cùng email → 201**; refresh token bị thu hồi sau khoá/xoá; `audit_logs` ghi đúng action; unlock tài khoản không khoá → 409.
- **FE (Vitest):** menu thao tác ẩn với User/Intern; hộp xác nhận xoá hiện trước khi gọi API; đổi trạng thái sau khoá/mở; nút ẩn đúng theo quy tắc ADMIN/tự mình.

## Ghi chú cho FE / BE
- **BE:** thao tác quản trị → `audit_logs`. Thu hồi refresh token là bắt buộc khi khoá/xoá. Giải phóng email là thay đổi dữ liệu có chủ ý, test phải chứng minh tạo lại cùng email thành công.
- **FE:** mọi ẩn/hiện chỉ là trải nghiệm. Hộp xác nhận xoá bắt buộc vì không có undo ở UI.
