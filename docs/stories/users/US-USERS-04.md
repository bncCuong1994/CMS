# US-USERS-04 Sửa thông tin người dùng

Vai trò: Super Admin | Admin
Là Super Admin hoặc Admin, tôi muốn sửa thông tin người dùng (họ tên, SĐT, chức danh, phòng ban, vai trò) để cập nhật nhân sự mà không cần can thiệp database.
Module: users
Giai đoạn: 2
Quyền cần: `user.update` (thêm `role.manage` global nếu đổi vai trò lên `ADMIN`)  Phạm vi: `global` (Super Admin) | `department` (Admin)

## Bối cảnh

- Chưa có endpoint sửa. Controller users chỉ có `GET`, `POST`.
- Quyền `user.update` ("Sửa thông tin, đổi vai trò người dùng") đã seed, Admin có sẵn.
- Kế hoạch (mục 3.3): đổi vai trò/phạm vi → **thu hồi refresh token** để buộc cấp lại grants.
- Kế hoạch cho phép một người (Admin) thuộc **nhiều phòng** → gán nhiều phòng ban làm ở đây (US-USERS-01 cố ý chỉ gán một phòng khi tạo).

## Quyết định thiết kế (đã chốt với người dùng 2026-10-12)

1. Admin chỉ sửa được trong phòng mình quản lý; **không** nâng ai lên `ADMIN` (cần `role.manage` global, giống lúc tạo).
2. Gán nhiều phòng: Admin chỉ thêm/bớt **các phòng mình quản lý**; phòng ngoài phạm vi mà người đó đang có **được giữ nguyên**, Admin không đụng tới. Super Admin thay thế toàn bộ.

## Giả định (ghi rõ để dễ đổi)

1. **PATCH bán phần**: chỉ trường nào gửi mới cập nhật. `phone`/`position` cho phép gửi `null` để xoá; `fullName` nếu gửi phải ≥ 2 ký tự; **không** cho đổi `email` trong story này (đổi email kéo theo unique + xác thực → story riêng).
2. **Không đổi mật khẩu** ở đây (đặt lại mật khẩu là story riêng khi có SMTP).
3. **Sửa người là `ADMIN`/`SUPER_ADMIN`** (mọi trường, gồm đổi vai trò) chỉ Super Admin làm được — đồng bộ với quy tắc "chỉ Super Admin quản lý Admin" ở US-USERS-05. Admin chỉ sửa được `USER`/`INTERN`.
4. **Đổi vai trò giữ nguyên lịch sử** công việc (gồm ca Intern → User theo kế hoạch): chỉ thay dòng `user_roles`, không xoá dữ liệu task/log.
5. `departmentIds` rỗng `[]` không hợp lệ cho Super Admin (người dùng phải thuộc ít nhất một phòng); với Admin, `[]` nghĩa là gỡ người khỏi mọi phòng Admin quản lý (nhưng vẫn giữ phòng ngoài phạm vi).
6. **Giới hạn đã biết (review 2026-10-12):** endpoint này chỉ đồng bộ `user_roles` phạm vi `department`, KHÔNG đụng dòng vai trò `global`. Vì DTO không cho set `SUPER_ADMIN`, không có đường "hạ cấp" một Super Admin qua đây; nếu Super Admin sửa một Super Admin khác và đặt `role=USER`, người đó sẽ giữ nguyên vai trò global cũ và thêm vai trò theo phòng. Chấp nhận trong phạm vi story (quản lý vai trò global để dành cho màn ma trận quyền sau).

## Thuật toán gán phòng (phần dễ sai nhất — ghi rõ cho BE)

Gọi `D_target` = tập phòng hiện tại của người bị sửa; `D_admin` = tập phòng người gọi quản lý (`departmentsWithPermission(grants, user.update)`); `D_req` = `departmentIds` trong body.

- **Super Admin** (`D_admin = 'all'`): tập phòng mới = `D_req` (thay toàn bộ). Mọi phòng trong `D_req` phải tồn tại, chưa xoá mềm.
- **Admin**: mọi phần tử `D_req` phải nằm trong `D_admin`, nếu không → `403`. Tập phòng mới = `(D_target \ D_admin) ∪ D_req` — giữ nguyên phòng ngoài phạm vi, chỉ ghi đè phần trong phạm vi bằng `D_req`.

## Tiêu chí nghiệm thu (Given/When/Then)

### AC1 — Mở form sửa
- **Given** tôi có `user.update` và đang ở bảng Người dùng
- **When** tôi bấm "Sửa" ở một dòng
- **Then** mở form điền sẵn họ tên, SĐT, chức danh, (các) phòng ban, vai trò hiện tại

### AC2 — Nút Sửa chỉ hiện với người có quyền trong phạm vi
- **Given** tôi là User hoặc Intern
- **Then** không thấy nút "Sửa" (`Can` với `user.update`). Backend vẫn trả 403 nếu gọi thẳng API.

### AC3 — Sửa thông tin cơ bản thành công
- **Given** tôi sửa họ tên/SĐT/chức danh hợp lệ
- **When** tôi lưu
- **Then** API trả `200`, bảng refresh, hiện toast "Đã cập nhật người dùng"
- **And** `audit_logs` có dòng `action = 'user.update'` với `before`/`after` chứa trường đã đổi

### AC4 — Gán nhiều phòng ban
- **Given** tôi là Super Admin
- **When** tôi gán người dùng vào Audio + Video rồi lưu
- **Then** `department_members` phản ánh đúng tập phòng mới; `user_roles` theo phạm vi tương ứng được đồng bộ

### AC5 — Đổi vai trò thu hồi phiên
- **Given** tôi đổi vai trò của một người (ví dụ `INTERN` → `USER`)
- **When** tôi lưu
- **Then** `user_roles` cập nhật đúng, **refresh token của người đó bị thu hồi** (`revoked_at` set), lần gọi API tiếp theo của họ bằng refresh token cũ phải thất bại và buộc đăng nhập lại
- **And** lịch sử công việc của người đó giữ nguyên

### AC6 — Admin không nâng lên ADMIN
- **Given** tôi là Admin phòng Audio, đang sửa một `USER`
- **When** tôi đặt vai trò `ADMIN` và lưu
- **Then** API trả `403` "Chỉ Super Admin được gán vai trò Admin"; FE ẩn sẵn lựa chọn `ADMIN` nếu không có `role.manage` global

### AC7 — Admin không sửa người ngoài phạm vi
- **Given** tôi là Admin phòng Audio
- **When** tôi gọi PATCH cho một người chỉ thuộc phòng Marketing
- **Then** API trả `403`, không thay đổi bản ghi nào

### AC8 — Admin không gán phòng ngoài phạm vi
- **Given** tôi là Admin chỉ quản lý Audio
- **When** tôi gửi `departmentIds` chứa id phòng Video
- **Then** API trả `403`; phòng ngoài phạm vi mà người đó đang có vẫn được giữ nguyên

### AC9 — Validate FE
- **Given** form đang mở
- **When** tôi để `fullName` < 2 ký tự hoặc `departmentIds` rỗng (khi là Super Admin)
- **Then** hiện lỗi tại trường, **không** gọi API

## Ca phân quyền

| Vai trò | Sửa `USER`/`INTERN` trong phòng mình | Sửa người phòng KHÁC | Sửa/đổi vai trò một `ADMIN` | Nâng lên `ADMIN` |
|---|---|---|---|---|
| **Super Admin** (`global`) | ✅ | ✅ mọi phòng | ✅ | ✅ |
| **Admin** (phòng được gán) | ✅ | ❌ **403** | ❌ **403** | ❌ **403** |
| **Admin ở phòng KHÔNG được gán** | — | ❌ **403** | ❌ **403** | ❌ **403** |
| **User** | ❌ **403** | ❌ **403** | ❌ **403** | ❌ **403** |
| **Intern** | ❌ **403** | ❌ **403** | ❌ **403** | ❌ **403** |

Ca bắt buộc có test: **Admin Audio PATCH người phòng Marketing → 403**; **Admin đặt role `ADMIN` → 403**; **đổi vai trò → refresh token bị revoke**; **User token hợp lệ PATCH → 403** (không phải 401).

## API contract

### `PATCH /api/v1/users/:id`

**Request** (mọi trường optional, bán phần)
```json
{
  "fullName": "Nguyễn Văn A",
  "phone": "0901234567",
  "position": "Trưởng nhóm",
  "departmentIds": ["uuid-audio", "uuid-video"],
  "role": "USER"
}
```

| Trường | Ràng buộc |
|---|---|
| `fullName` | nếu có: ≥ 2 ký tự |
| `phone` | chuỗi hoặc `null` |
| `position` | chuỗi hoặc `null` |
| `departmentIds` | nếu có: mảng uuid, mỗi phòng tồn tại & chưa xoá; theo thuật toán phạm vi ở trên |
| `role` | nếu có: `ADMIN` \| `USER` \| `INTERN` (không cho `SUPER_ADMIN`) |

**Response `200`**: người dùng sau khi sửa theo `USER_SELECT` (giống item của `GET /users`).

**Mã lỗi**

| Mã | Khi nào | Thông báo |
|---|---|---|
| `400` | validate DTO thất bại | message class-validator |
| `401` | không/sai token | `Unauthorized` |
| `403` | thiếu `user.update`; sửa người ngoài phạm vi; gán phòng ngoài phạm vi; sửa/đổi vai trò một Admin mà không có `role.manage` global | `Không có quyền...` / `Chỉ Super Admin được gán vai trò Admin` |
| `404` | user không tồn tại/đã xoá mềm, hoặc phòng trong `departmentIds` không tồn tại | `Không tìm thấy người dùng` / `Không tìm thấy phòng ban` |

## Phụ thuộc
- `GET /api/v1/departments` — dropdown phòng. `GET /api/v1/users` — refresh bảng.
- Dịch vụ thu hồi refresh token: dùng bảng `refresh_tokens` (có `revoked_at`). Nếu auth module đã export hàm revoke theo `userId` thì gọi qua service đó (không truy vấn thẳng bảng module khác — rule bất biến #3).
- **Thứ tự:** sau US-USERS-03 (cùng chạm bảng/`api.ts`). Cùng loại hợp đồng với US-USERS-02.

## Task

### BE-01 — Endpoint PATCH + đồng bộ phòng/vai trò + thu hồi phiên
- `UpdateUserDto` (các trường optional ở trên).
- `@RequirePermission(user.update)` + kiểm phạm vi **theo phòng của người bị sửa** (trong service, vì phạm vi lấy từ target chứ không từ body); chặn Admin→ADMIN và Admin sửa Admin.
- Trong transaction: cập nhật user; đồng bộ `department_members` + `user_roles` theo thuật toán phạm vi; nếu đổi vai trò thì gọi service auth thu hồi refresh token của user; ghi `audit_logs` `user.update` kèm `before`/`after`.

### FE-01 — Form sửa
- Nút "Sửa" mỗi dòng (bọc `Can` `user.update`), mở `Dialog` dùng react-hook-form + zod, điền sẵn dữ liệu.
- Multi-select phòng ban từ `useDepartments`; dropdown vai trò ẩn `ADMIN` nếu không có `role.manage` global (kiểm tra `grants.global.includes('role.manage')`, không dùng `usePermission` — xem decisions US-USERS-01).
- `useMutation` PATCH; thành công → `invalidateQueries(['users'])`, đóng, toast; lỗi 403/404 hiện thông báo, giữ form mở.

### TEST-01 — Kiểm thử
- **BE (e2e):** ma trận 4 vai trò; Admin sửa người phòng khác → 403; Admin→ADMIN → 403; thuật toán phòng (giữ phòng ngoài phạm vi); đổi vai trò → `refresh_tokens.revoked_at` set + refresh cũ bị từ chối; `audit_logs` ghi `user.update`; lịch sử task giữ nguyên.
- **FE (Vitest):** nút Sửa ẩn với User/Intern; form điền sẵn; validate chặn submit; lựa chọn `ADMIN` ẩn với Admin.

## Ghi chú cho FE / BE
- **BE:** thao tác quản trị → `audit_logs`, **không** `activity_events`. Thu hồi refresh token là bắt buộc khi đổi vai trò/phạm vi (kế hoạch 3.3).
- **FE:** ẩn nút/lựa chọn chỉ là trải nghiệm; backend vẫn chặn.
