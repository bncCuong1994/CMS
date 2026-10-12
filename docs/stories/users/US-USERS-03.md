# US-USERS-03 Tìm kiếm, lọc và cột chức danh ở bảng Người dùng

Vai trò: Super Admin | Admin | User
Là người có quyền xem danh sách người dùng, tôi muốn tìm theo tên/email và lọc theo vai trò, trạng thái, phòng ban, đồng thời thấy cột chức danh, để nhanh chóng tìm đúng người trong bảng lớn.
Module: users
Giai đoạn: 2
Quyền cần: `user.read`  Phạm vi: `global` (Super Admin) | `department` (Admin, User)

## Bối cảnh & hiện trạng

- `GET /api/v1/users` hiện chỉ nhận `departmentId` (`ListUsersQuery`), **không** search, không lọc vai trò/trạng thái, và **không phân trang** (`users.service.ts:37` dùng `findMany` không `take/skip` — nợ "Cao" trong backlog). Story này trả luôn nợ pagination.
- Bảng web (`users-page.tsx`) **chưa render** cột Chức danh dù `UserRow.position` đã có sẵn dữ liệu.
- Backend **đã** lọc theo phạm vi: `departmentsWithPermission(grants, user.read)` quyết định người gọi thấy phòng nào. Search/filter chỉ áp dụng **trong** phạm vi đó.

## Quyết định thiết kế (đã chốt với người dùng 2026-10-12)

1. **Server-side toàn bộ.** Search + filter + phân trang làm ở backend, không kéo cả bảng về client. Đổi `GET /users` từ trả mảng thẳng sang **envelope phân trang** `{ data, meta }`.
2. Đây là **breaking change** của hợp đồng `GET /users` → `features/users/api.ts` (`UserRow[]` → `{ data, meta }`) và test của US-USERS-01 phải cập nhật. Xem mục Phụ thuộc về thứ tự merge.

## Giả định (ghi rõ để dễ đổi)

1. `q` tìm **chứa** (ILIKE `%q%`, không phân biệt hoa/thường, không phân biệt dấu nếu DB hỗ trợ) trên `full_name` **hoặc** `email`. `q` rỗng/khoảng trắng → bỏ qua. Không yêu cầu độ dài tối thiểu.
2. `pageSize` mặc định `20`, tối đa `100`; `page` mặc định `1`. Vượt `max` → kẹp về `max` (không trả 400) để FE không vỡ.
3. Các bộ lọc `role`, `status`, `departmentId` **chọn nhiều giá trị**. Truyền lên dưới dạng **lặp tham số** (`?role=USER&role=INTERN`) hoặc **phẩy ngăn cách** (`?role=USER,INTERN`); backend chấp nhận cả hai, chuẩn hoá về mảng. Trong một bộ lọc = OR (`in [...]`); người đa vai trò/đa phòng khớp nếu có một giá trị trùng. Giữa các bộ lọc = AND.
4. Sắp xếp mặc định giữ nguyên `createdAt desc`. Sắp xếp theo cột để story sau.

## Tiêu chí nghiệm thu (Given/When/Then)

### AC1 — Cột Chức danh
- **Given** tôi mở màn Người dùng
- **Then** bảng có thêm cột **Chức danh** giữa cột Email/SĐT và Phòng ban, hiển thị `position`; rỗng thì hiện `–`

### AC2 — Tìm theo tên/email
- **Given** bảng đang hiển thị
- **When** tôi gõ chuỗi vào ô tìm kiếm
- **Then** sau khi debounce (~300ms) bảng chỉ còn người có `full_name` **hoặc** `email` chứa chuỗi đó, và phân trang reset về trang 1
- **And** tìm kiếm chỉ trong phạm vi phòng ban tôi được xem (Admin không tìm thấy người phòng khác)

### AC3 — Lọc vai trò / trạng thái / phòng ban (chọn nhiều)
- **Given** bảng đang hiển thị
- **When** tôi chọn **một hoặc nhiều** vai trò (ví dụ `USER` + `INTERN`), và/hoặc nhiều trạng thái, và/hoặc nhiều phòng ban
- **Then** trong cùng một bộ lọc, nhiều giá trị ghép bằng **OR** (khớp bất kỳ giá trị nào đã chọn); giữa các bộ lọc khác nhau và với ô tìm kiếm ghép bằng **AND**
- **And** bỏ chọn hết một bộ lọc = không áp dụng bộ lọc đó
- **And** dropdown Phòng ban chỉ liệt kê phòng tôi được xem (lấy từ `GET /departments`)

### AC4 — Phân trang
- **Given** có nhiều hơn `pageSize` người dùng trong phạm vi
- **Then** bảng hiện tối đa `pageSize` dòng, có điều khiển chuyển trang và tổng số bản ghi (`meta.total`)
- **When** tôi đổi trang hoặc đổi bộ lọc
- **Then** gọi lại API với `page`/`pageSize`/filter tương ứng (không lọc ở client)

### AC5 — Trạng thái rỗng
- **Given** bộ lọc không khớp ai
- **Then** hiện "Không tìm thấy người dùng phù hợp." (khác thông báo "Chưa có người dùng nào." khi bảng thực sự trống)

### AC6 — Phạm vi bị vi phạm
- **Given** tôi là Admin phòng Audio
- **When** tôi gọi trực tiếp API với `departmentId` của phòng Marketing
- **Then** API trả `403`, không rò dữ liệu phòng Marketing

## Ca phân quyền

| Vai trò | Vào màn/`GET /users` | Lọc `departmentId` phòng mình | Lọc `departmentId` phòng KHÁC |
|---|---|---|---|
| **Super Admin** (`global`) | ✅ thấy toàn công ty | ✅ | ✅ (mọi phòng) |
| **Admin** (phòng được gán) | ✅ chỉ các phòng được gán | ✅ | ❌ **403** |
| **Admin ở phòng KHÔNG được gán** | ✅ nhưng phòng đó không có trong kết quả/dropdown | — | ❌ **403** |
| **User** | ✅ chỉ người cùng phòng mình (`user.read` có trong vai trò User) | ✅ phòng mình | ❌ **403** |
| **Intern** | ❌ **403** (không có `user.read`) | ❌ | ❌ |

Ca bắt buộc có test: **Admin phòng Audio `GET /users?departmentId=<Marketing>` → 403**; **Intern `GET /users` → 403** (không phải 401, token hợp lệ).

## API contract

### `GET /api/v1/users`

**Query params** (bổ sung vào `ListUsersQuery`)

| Tham số | Bắt buộc | Ràng buộc |
|---|---|---|
| `q` | không | chuỗi, tìm chứa trên `fullName`/`email` (một giá trị) |
| `role` | không | **nhiều giá trị** (lặp hoặc phẩy); mỗi giá trị ∈ `ADMIN` \| `USER` \| `INTERN` \| `SUPER_ADMIN`; ghép OR (`in`) |
| `status` | không | **nhiều giá trị**; mỗi giá trị ∈ `active` \| `inactive` \| `locked`; ghép OR (`in`) |
| `departmentId` | không | **nhiều giá trị** uuid; ghép OR (`in`); **bất kỳ** giá trị ngoài phạm vi → `403` (giữ hành vi phạm vi hiện tại) |
| `page` | không | int ≥ 1, mặc định `1` |
| `pageSize` | không | int 1–100, mặc định `20`, vượt thì kẹp về `100` |

**Response `200`** — envelope phân trang (đổi từ mảng thẳng):
```json
{
  "data": [
    {
      "id": "uuid", "email": "a@cms.local", "fullName": "Nguyễn Văn A",
      "phone": "0901234567", "position": "Chuyên viên",
      "status": "active", "lastLoginAt": "2026-10-10T03:00:00.000Z",
      "departments": [{ "id": "uuid", "name": "Audio" }],
      "roles": [{ "role": "USER", "departmentId": "uuid" }]
    }
  ],
  "meta": { "total": 137, "page": 1, "pageSize": 20 }
}
```

**Mã lỗi**

| Mã | Khi nào | Thông báo |
|---|---|---|
| `400` | query sai kiểu (page/pageSize không phải số, status/role ngoài enum) | message class-validator |
| `401` | không/sai access token | `Unauthorized` |
| `403` | thiếu `user.read`, hoặc `departmentId` ngoài phạm vi | `Không có quyền xem phòng ban này` |

## Phụ thuộc

- **Thứ tự merge:** story này đổi hợp đồng `GET /users` → phải sau khi **US-WEB-01** (axios) và **US-USERS-01** merge, và nên **sau US-USERS-02** (chuẩn hoá kiểu users vào `shared-types`) để `data`/`meta` khai một nơi. Nếu làm trước US-USERS-02 thì tạm khai `PaginatedUsers` trong `features/users/api.ts` và ghi nợ.
- `GET /api/v1/departments` — đã có, nạp dropdown lọc phòng.
- Test của US-USERS-01 (`users-create.e2e-spec.ts`, `users-page.test.tsx`) assert `GET /users` trả mảng → **phải cập nhật** sang đọc `.data`.

## Task

### BE-01 — Mở rộng `GET /users`
- Thêm `q`, `role`, `status`, `page`, `pageSize` vào `ListUsersQuery` (class-validator + `@ApiPropertyOptional`), kẹp `pageSize` ≤ 100.
- `role`, `status`, `departmentId` nhận **mảng**: `@Transform` chuẩn hoá cả dạng lặp tham số và phẩy-ngăn-cách về mảng, `@IsArray` + validate từng phần tử theo enum/uuid.
- `UsersService.list`: thêm điều kiện `where` (ILIKE qua `mode: 'insensitive'` của Prisma cho `fullName`/`email`; lọc `status` bằng `in`; lọc `role` qua quan hệ `roles.some.role.code in [...]`; lọc nhiều `departmentId` bằng `in`), giữ nguyên lọc phạm vi hiện có. Khi có nhiều `departmentId`: nếu **bất kỳ** id nào ngoài phạm vi → `403`.
- Dùng `prisma.$transaction([findMany({ take, skip, orderBy }), count()])` để trả `data` + `meta.total`. Giữ `USER_SELECT`.
- **Không** đổi logic phân quyền phạm vi.

### FE-01 — Thanh tìm kiếm, bộ lọc, cột chức danh, phân trang
- Thêm cột **Chức danh** vào bảng.
- Ô tìm kiếm có debounce; 3 bộ lọc **chọn nhiều** (vai trò, trạng thái, phòng ban từ `useDepartments`) — dùng popover + checkbox hoặc multi-select, có nút xoá lựa chọn; điều khiển phân trang.
- Serialize giá trị nhiều lựa chọn vào query param (lặp hoặc phẩy) khớp hợp đồng BE; đổi bất kỳ bộ lọc nào reset trang về 1.
- `useUsers` nhận tham số filter/paging, đổi kiểu trả về sang `{ data, meta }`; mọi filter đẩy vào `queryKey` để TanStack Query cache theo bộ lọc.
- Cập nhật `users-page.tsx` đọc `data.data`/`data.meta`; thêm trạng thái rỗng-do-lọc (AC5).

### TEST-01 — Kiểm thử
- **BE (e2e):** `q` khớp tên và email; **chọn nhiều** giá trị trong một bộ lọc = OR (`?role=USER,INTERN` trả cả hai nhóm); nhiều bộ lọc cộng dồn = AND; phân trang (`total`, `take/skip` đúng); Admin lọc một trong nhiều `departmentId` ngoài phạm vi → 403; Intern → 403; cập nhật các assert cũ sang `.data`.
- **FE (Vitest):** render cột Chức danh; gõ tìm kiếm gọi API với `q` (debounce); chọn **nhiều** giá trị một bộ lọc đẩy đúng query param dạng mảng; nhiều bộ lọc cộng dồn; đổi trang gọi lại API; trạng thái rỗng-do-lọc.

## Ghi chú cho FE / BE
- **BE:** đây là thao tác đọc, **không** ghi `audit_logs`/`activity_events`.
- **FE:** không tự lọc/phân trang ở client; mọi điều kiện gửi lên server. Ẩn/hiện chỉ là trải nghiệm, backend vẫn chặn phạm vi.
