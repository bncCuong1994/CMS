# US-USERS-01 Tạo tài khoản người dùng từ màn Người dùng

Vai trò: Super Admin | Admin
Là Super Admin hoặc Admin, tôi muốn tạo tài khoản người dùng mới ngay trên màn Người dùng để đưa nhân sự vào hệ thống mà không cần can thiệp database.
Module: users
Giai đoạn: 2
Quyền cần: `user.create` (thêm `role.manage` nếu tạo tài khoản Admin)  Phạm vi: `department` (Admin) | `global` (Super Admin)

## Hiện trạng (đã có sẵn từ giai đoạn 1)

Backend `POST /api/v1/users` **đã tồn tại và đã đúng phần lõi**:
- Guard `@RequirePermission(PERMISSIONS.USER_CREATE, { departmentFrom: { source: 'body', key: 'departmentId' } })` đã kiểm tra cả quyền và phạm vi phòng ban.
- `UsersService.create` đã chặn Admin tạo tài khoản Admin (yêu cầu `role.manage` ở phạm vi global).
- Đã băm mật khẩu bằng argon2, chặn email trùng, tạo `department_members` + `user_roles` trong cùng transaction, ghi `audit_logs`.

Phần **chưa có**: trường `phone`, và toàn bộ giao diện (màn Người dùng hiện chỉ có bảng đọc, không có nút tạo).

## Quyết định thiết kế: "permission" trong popup là CHỈ ĐỌC

Yêu cầu ban đầu nói popup có "role, permission". Theo kiến trúc đã chốt (mục 3.3 của `docs/ke-hoach-kien-truc.md`):

> Vai trò = tập quyền (bảng `role_permissions`). Người dùng được gán vai trò **kèm phạm vi** (bảng `user_roles`).

Hệ thống **không có** bảng gán quyền riêng cho từng người dùng. Quyền của một người = hợp các quyền của các vai trò người đó được gán. Vì vậy popup:

- **Chọn vai trò** (`ADMIN` | `USER` | `INTERN`) — đây là thứ quyết định quyền.
- **Hiển thị quyền ở dạng xem trước, chỉ đọc** — danh sách quyền mà vai trò vừa chọn sẽ có, để người tạo biết mình đang cấp những gì. Không cho tick chọn từng quyền.

Đổi vai trò trong dropdown thì danh sách quyền xem trước phải cập nhật ngay.

## Giả định (chưa được xác nhận trực tiếp, ghi rõ để dễ đổi)

1. **Một phòng ban khi tạo.** `CreateUserDto` hiện nhận một `departmentId`. Kế hoạch cho phép Admin thuộc nhiều phòng, nhưng việc gán thêm phòng để dành cho chức năng sửa người dùng (story sau), không làm trong popup tạo.
2. **Người tạo tự đặt mật khẩu.** Chưa có dịch vụ email nên không làm luồng "gửi link đặt mật khẩu". Popup có trường mật khẩu, tối thiểu 8 ký tự, kèm nút hiện/ẩn.
3. **Nguồn dữ liệu quyền xem trước** lấy từ `DEFAULT_ROLES` trong `@cms/shared-types`, không gọi API. Rủi ro: khi màn ma trận quyền (story sau) cho Super Admin sửa quyền của vai trò, bản xem trước sẽ lệch so với DB. Lúc đó phải đổi sang `GET /api/v1/roles`. Chấp nhận nợ này vì màn ma trận chưa có.
4. **Trạng thái khởi tạo** là `active`.
5. Không cho tạo `SUPER_ADMIN` qua API này (`DEPARTMENT_ROLES` đã loại sẵn).

## Tiêu chí nghiệm thu (Given/When/Then)

### AC1 — Mở popup
- **Given** tôi là Super Admin hoặc Admin đang ở màn Người dùng
- **When** tôi bấm nút "Tạo người dùng"
- **Then** popup mở ra với các trường: Họ tên, Email, Mật khẩu, Số điện thoại, Chức danh, Phòng ban, Vai trò, và khối "Quyền của vai trò này" ở dạng chỉ đọc

### AC2 — Nút chỉ hiện với người có quyền
- **Given** tôi là User hoặc Intern
- **When** tôi vào màn Người dùng
- **Then** không thấy nút "Tạo người dùng" (ẩn bằng `Can` / `hasPermission` với `user.create`)
- **Lưu ý:** đây chỉ là trải nghiệm. Backend vẫn phải trả 403 nếu gọi API trực tiếp.

### AC3 — Danh sách phòng ban theo phạm vi
- **Given** tôi là Admin được gán phòng Audio và Video
- **When** tôi mở popup
- **Then** dropdown Phòng ban chỉ có Audio và Video, không có Marketing
- **And** nếu tôi là Super Admin thì dropdown có toàn bộ phòng ban

### AC4 — Quyền xem trước đổi theo vai trò
- **Given** popup đang mở
- **When** tôi chọn vai trò `INTERN`
- **Then** khối quyền hiển thị đúng 2 quyền: `department.read`, `task.update_own` (kèm mô tả tiếng Việt từ `PERMISSION_DESCRIPTIONS`)
- **When** tôi đổi sang `USER`
- **Then** khối quyền cập nhật thành 5 quyền của vai trò User

### AC5 — Tạo thành công
- **Given** tôi điền hợp lệ mọi trường bắt buộc
- **When** tôi bấm "Tạo"
- **Then** API trả `201`, popup đóng, bảng người dùng tự refresh và có dòng mới
- **And** hiện thông báo thành công
- **And** `audit_logs` có một dòng `action = 'user.create'` với `actor_id` là tôi
- **And** `department_members` và `user_roles` có bản ghi tương ứng, `user_roles.scope_type = 'department'`, `scope_id` = phòng đã chọn

### AC6 — Email trùng
- **Given** email `admin@cms.local` đã tồn tại
- **When** tôi tạo người dùng với email đó
- **Then** API trả `409` với thông báo "Email đã được sử dụng"
- **And** popup **không đóng**, giữ nguyên dữ liệu đã nhập, hiện lỗi ngay dưới trường Email

### AC7 — Validate phía FE
- **Given** popup đang mở
- **When** tôi bấm "Tạo" mà bỏ trống trường bắt buộc, hoặc email sai định dạng, hoặc mật khẩu dưới 8 ký tự
- **Then** hiện lỗi ngay tại trường tương ứng và **không gọi API**

### AC8 — Admin không tạo được Admin
- **Given** tôi là Admin của phòng Audio
- **When** tôi chọn vai trò `ADMIN` và bấm Tạo
- **Then** API trả `403` "Chỉ Super Admin được tạo tài khoản Admin"
- **And** FE nên ẩn luôn lựa chọn `ADMIN` trong dropdown nếu tôi không có `role.manage` ở phạm vi global, để không dẫn người dùng vào lỗi

### AC9 — Không tạo được ở phòng không được gán
- **Given** tôi là Admin của phòng Audio
- **When** tôi gọi trực tiếp API với `departmentId` của phòng Marketing
- **Then** API trả `403`, không tạo bản ghi nào

## Ca phân quyền

| Vai trò | Thấy nút "Tạo người dùng" | `POST /users` trong phòng được gán | `POST /users` ở phòng khác | Tạo vai trò `ADMIN` |
|---|---|---|---|---|
| **Super Admin** (`global`) | Có | ✅ 201, mọi phòng | ✅ 201 | ✅ 201 |
| **Admin** (phòng được gán) | Có | ✅ 201 | ❌ **403** | ❌ **403** |
| **Admin ở phòng KHÔNG được gán** | Có (nút chung) nhưng phòng đó không có trong dropdown | — | ❌ **403** | ❌ **403** |
| **User** | Không | ❌ **403** | ❌ **403** | ❌ **403** |
| **Intern** | Không | ❌ **403** | ❌ **403** | ❌ **403** |

Ca bắt buộc phải có test: **Admin phòng Audio gọi `POST /users` với `departmentId` của Marketing → 403**, và **User có token hợp lệ gọi `POST /users` → 403** (không phải 401).

## API contract

### `POST /api/v1/users`

Đã tồn tại. Thay đổi duy nhất: thêm `phone` (tuỳ chọn).

**Request**
```json
{
  "email": "nhanvien@cms.local",
  "fullName": "Nguyễn Văn A",
  "password": "MatKhau@123",
  "phone": "0901234567",
  "departmentId": "uuid-phong-ban",
  "role": "USER",
  "position": "Chuyên viên"
}
```

| Trường | Bắt buộc | Ràng buộc |
|---|---|---|
| `email` | có | định dạng email, lưu lowercase, unique |
| `fullName` | có | tối thiểu 2 ký tự |
| `password` | có | tối thiểu 8 ký tự |
| `phone` | không | chuỗi |
| `departmentId` | có | uuid, phòng ban phải tồn tại và chưa xoá mềm |
| `role` | có | `ADMIN` \| `USER` \| `INTERN` |
| `position` | không | chuỗi |

**Response `201`**
```json
{ "id": "uuid", "email": "nhanvien@cms.local", "fullName": "Nguyễn Văn A", "status": "active" }
```

⚠️ **Response `201` KHÔNG trả `phone`** (hàm `create` dùng `select` riêng, hẹp hơn `USER_SELECT`). FE đừng đọc `phone` từ response tạo; muốn hiện ngay thì dựa vào `invalidateQueries(['users'])` để nạp lại `GET /users` — chỗ đó mới có `phone`.

**Mã lỗi**

| Mã | Khi nào | Thông báo |
|---|---|---|
| `400` | validate DTO thất bại | mảng message của class-validator |
| `403` | ⚠️ **thiếu `departmentId` trong body** và người gọi không có quyền `global` | `Thiếu phòng ban` — guard chạy trước `ValidationPipe` nên Admin nhận 403 thay vì 400; Super Admin cùng body đó nhận 400. Đã chốt chấp nhận, xem `docs/decisions.md`. |
| `401` | không có / sai access token | `Unauthorized` |
| `403` | thiếu `user.create`, hoặc `departmentId` ngoài phạm vi | `Không có quyền...` |
| `403` | tạo `ADMIN` mà không có `role.manage` global | `Chỉ Super Admin được tạo tài khoản Admin` |
| `404` | phòng ban không tồn tại | `Không tìm thấy phòng ban` |
| `409` | email trùng | `Email đã được sử dụng` |

### `GET /api/v1/departments`
Đã tồn tại, dùng để nạp dropdown Phòng ban. FE **không cần tự lọc theo phạm vi** — backend đã trả về đúng các phòng người gọi được xem.

## Phụ thuộc

- `GET /api/v1/departments` — đã có.
- `GET /api/v1/users` — đã có, dùng để refresh bảng sau khi tạo.
- `DEFAULT_ROLES`, `PERMISSION_DESCRIPTIONS` trong `@cms/shared-types` — đã có.
- FE **thiếu** component shadcn: `dialog`, `select`, `form`. Và **thiếu dependency** `react-hook-form`, `zod`, `@hookform/resolvers` (kế hoạch đã chốt dùng bộ này nhưng chưa cài).

## Task

### BE-01 — Thêm `phone` vào luồng tạo người dùng — ✅ XONG (2026-10-12)
- Thêm `phone?: string` vào `CreateUserDto` (`@IsOptional() @IsString()`, kèm `@ApiPropertyOptional`).
- Truyền `phone` vào `prisma.user.create`. Cột `phone` đã có trong schema (`schema.prisma:44`), **không cần migration**.
- Bổ sung `phone` vào `USER_SELECT` (đã làm) → `GET /users` giờ trả thêm trường `phone`.
- Giữ nguyên toàn bộ logic phân quyền và transaction hiện tại — **không sửa**.

File đã sửa: `apps/api/src/modules/users/dto.ts`, `apps/api/src/modules/users/users.service.ts`. Lint + build + test (6/6) đã qua.

### FE-01 — Nút và popup tạo người dùng — ✅ XONG (2026-10-12)
File thêm: `components/ui/{dialog,select,form,sonner}.tsx`; `features/users/{api.ts,schemas.ts,create-user-dialog.tsx,role-permissions-preview.tsx,use-can-create-admin.ts}`; `lib/departments.ts`; `test-utils.tsx` + 2 file test.
File sửa: `users-page.tsx`, `app-layout.tsx` (mount `<Toaster />`), `departments-page.tsx` (chuyển sang `useDepartments()`), `test-setup.ts` (stub `ResizeObserver`/pointer capture cho Radix trong jsdom).
Deps: `react-hook-form`, `zod`, `@hookform/resolvers`, `sonner`, `@radix-ui/react-{dialog,select}`, dev `@testing-library/user-event`.
Lint + build qua; 15/15 test Vitest pass (trong đó 12 test mới của FE phần TEST-01).

- Cài `react-hook-form`, `zod`, `@hookform/resolvers`; thêm shadcn `dialog`, `select`, `form`.
- Nút "Tạo người dùng" ở đầu màn Người dùng, bọc trong kiểm tra quyền `user.create`.
- Popup dùng `Dialog` + `react-hook-form` + schema zod khớp đúng ràng buộc ở bảng trên.
- Dropdown Phòng ban nạp từ `GET /departments` qua TanStack Query.
- Dropdown Vai trò: lọc bỏ `ADMIN` nếu người dùng không có `role.manage` ở phạm vi global.
- Khối "Quyền của vai trò này": đọc `DEFAULT_ROLES` theo vai trò đang chọn, hiện mã quyền + mô tả từ `PERMISSION_DESCRIPTIONS`. Chỉ đọc.
- Submit bằng `useMutation`; thành công thì `invalidateQueries(['users'])`, đóng popup, hiện toast.
- Lỗi `409` phải map vào trường Email và **giữ popup mở**.

### TEST-01 — Kiểm thử — ✅ XONG (2026-10-12)
**BE:** `test/users-create.e2e-spec.ts` (43 test) + hạ tầng `test/setup/global-{setup,teardown}.ts` (Testcontainers `postgres:17-alpine`, db `cms_test`, `prisma migrate deploy`), `test/helpers/test-app.ts`, `test/fixtures/actors.ts` (3 phòng ngang cấp + 7 tài khoản, token lấy bằng **đăng nhập thật** qua `POST /auth/login`). Ma trận kết quả thực tế: `docs/test-cases/users.md`. `test:e2e` 57/57 pass.
**FE:** 12 test trong `features/users/*.test.tsx`. Tổng web 15/15 pass.
Mọi ca không-201 đều snapshot số dòng `users`/`department_members`/`user_roles`/`audit_logs` trước-sau và assert không đổi. Ca User/Intern 403 có bước gọi `GET /auth/me` → 200 ngay trước để chứng minh token thật sự hợp lệ (403 đến từ phân quyền, không phải token hỏng). Mật khẩu: kiểm hash `$argon2`, `argon2.verify` đúng, và raw query `users::text LIKE '%<password>%'` trả 0 dòng.

- **BE (Jest + Supertest):** ma trận phân quyền 4 vai trò ở bảng trên; ca Admin phòng Audio tạo ở phòng Marketing → 403; ca Admin tạo `ADMIN` → 403; email trùng → 409; phòng ban không tồn tại → 404; tạo thành công → kiểm tra `department_members`, `user_roles` (`scope_type`, `scope_id`) và một dòng `audit_logs` `action='user.create'`.
- **FE (Vitest + Testing Library):** nút ẩn với User/Intern; validate chặn submit khi thiếu trường; khối quyền đổi đúng khi đổi vai trò (`INTERN` → 2 quyền, `USER` → 5 quyền); lỗi 409 hiện dưới trường Email và popup không đóng.

## Ghi chú cho FE / BE

**BE:** Không đổi chữ ký API ngoài việc thêm `phone`. Phần `audit_logs` đã ghi trong transaction, giữ nguyên. Theo rule bất biến số 5, tạo người dùng là thao tác quản trị nên `audit_logs` là đủ, **không cần** ghi `activity_events` (bảng đó dành cho hoạt động của chính người dùng, phục vụ quy tắc Intern 30 ngày và báo cáo).

**FE:** Việc ẩn nút và ẩn lựa chọn `ADMIN` **chỉ để trải nghiệm**, không phải cơ chế bảo mật — backend đã chặn. Đừng tự lọc danh sách phòng ban theo `grants` ở FE; cứ hiển thị đúng những gì `GET /departments` trả về, vì backend đã lọc theo phạm vi.

## Ghi chú kỹ thuật đã khảo sát (để phiên làm việc sau không phải tìm lại)

1. **Không có `GET /me/permissions` ở FE.** Quyền lấy từ Zustand store, không qua TanStack Query:
   ```ts
   // apps/web/src/features/auth/use-permission.ts
   export function usePermission(permission: Permission, departmentId?: string | null): boolean
   ```
   Nên test phải mock `useAuthStore`, **không** mock query client. Tham khảo `can.test.tsx`.

2. **✅ Đã xác minh (2026-10-12).** `hasPermission` trong `packages/shared-types/src/auth.ts:30-38`:
   ```ts
   if (grants.global.includes(permission)) return true;
   if (departmentId) return grants.departments[departmentId]?.includes(permission) ?? false;
   return Object.values(grants.departments).some((perms) => perms.includes(permission));
   ```
   Bỏ trống `departmentId` nghĩa là **"có ở bất kỳ phạm vi nào"**, không phải "chỉ global".
   - **Kết luận cho AC8:** **không được** dùng `usePermission('role.manage')` để ẩn/hiện lựa chọn `ADMIN`. Phải kiểm tra thẳng `grants.global.includes('role.manage')` lấy từ `useAuthStore`, đúng như backend đang làm trong `UsersService.create`.
   - Đây chỉ ảnh hưởng trải nghiệm, không phải lỗ hổng bảo mật (backend vẫn chặn), nhưng làm sai thì AC8 không đạt.

3. **Chữ ký api client** là `api<T>(path, { method, json })`, không phải `api.post(...)`:
   ```ts
   api<CreateUserResponse>('/users', { method: 'POST', json: body })
   ```
   `ApiError` có sẵn `.status` — dùng để bắt `409` cho AC6.
