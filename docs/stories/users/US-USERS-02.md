# US-USERS-02 Chuẩn hoá kiểu request/response module users vào shared-types

Vai trò: Super Admin | Admin | User | Intern
Là người bảo trì hệ thống, tôi muốn kiểu request/response của module users nằm ở một chỗ duy nhất trong `packages/shared-types` để FE và BE không lệch hợp đồng API khi một bên đổi trường.
Module: users
Giai đoạn: 2
Quyền cần: không (story kỹ thuật, không thêm endpoint, không đổi hành vi phân quyền)  Phạm vi: —

> **Loại story:** nợ kỹ thuật (refactor). Không thêm tính năng cho người dùng cuối. Phát hiện khi làm BE-01 của `US-USERS-01` (2026-10-12).

## Vấn đề

Hợp đồng API module users hiện bị khai **ba lần ở ba chỗ, không chỗ nào tham chiếu chỗ nào**:

| Nơi khai | File | Nội dung |
|---|---|---|
| BE request | `apps/api/src/modules/users/dto.ts` | `CreateUserDto`, `ListUsersQuery` (class-validator) |
| BE response | `apps/api/src/modules/users/users.service.ts` | `USER_SELECT` (Prisma select) + hình dạng trả về do `map` tự tạo |
| FE | `apps/web/src/features/users/users-page.tsx:7` | `interface UserRow` khai cục bộ, copy tay |

`packages/shared-types/src/auth.ts` chỉ có `MeResponse` phục vụ phiên đăng nhập; **không có** `CreateUserRequest`, `CreateUserResponse`, `UserListItem`.

### Hậu quả đã thấy thật, không phải giả định

1. BE-01 thêm `phone` vào `USER_SELECT` → `GET /users` trả thêm trường, nhưng `UserRow` ở FE không hề biết. TypeScript **không báo lỗi** vì hai kiểu không liên quan gì nhau. FE phải sửa tay, quên là mất trường.
2. `POST /users` trả `{ id, email, fullName, status }` còn `GET /users` trả nhiều trường hơn. Không có kiểu nào ghi lại sự khác biệt này → FE-01 từng có nguy cơ đọc `phone` từ response tạo (đã phải ghi chú tay vào `US-USERS-01` để chặn).
3. Mọi story users về sau (sửa, khoá, chuyển Intern → User) đều sẽ lặp lại đúng lỗi này.

Trái với chuẩn đã chốt: kiểu request/response dùng chung đặt trong `packages/shared-types`.

## Phạm vi

**Trong phạm vi** — chỉ hợp đồng của module `users`:
- `CreateUserRequest`, `CreateUserResponse`
- `UserListItem` (phần tử của `GET /users`), `ListUsersQuery`
- `UserStatus`, `LockedReason` nếu chưa có kiểu dùng chung

**Ngoài phạm vi (cố ý, để một PR không đụng hai module):**
- `DepartmentRow` — FE-01 đã gom về `apps/web/src/lib/departments.ts` (một chỗ duy nhất ở FE, không còn copy ở `departments-page.tsx`) nhưng **vẫn chưa** là kiểu dùng chung với BE → mở story riêng cho module `departments`.
- `UserRow`/`CreateUserBody`/`CreateUserResponse` mà FE-01 khai trong `apps/web/src/features/users/api.ts` (đã để TODO sẵn) chính là phần FE-02 phải xoá.
- Không đổi `MeResponse`, `LoginResponse`, `hasPermission`.
- **Không đổi hành vi API nào**: không thêm/bớt/đổi tên trường, không đổi mã lỗi, không chạm guard hay transaction. Đây là điều kiện nghiệm thu, không phải lời khuyên.

## Giả định

1. **BE giữ class-validator, không chuyển sang zod.** `CreateUserDto` vẫn là class có decorator (NestJS cần metadata để validate), nhưng **phải `implements CreateUserRequest`** để compiler bắt lệch. Không đập đi làm lại bằng zod — việc đó là quyết định kiến trúc, phải hỏi riêng.
2. **`shared-types` chỉ chứa kiểu và hằng, không chứa logic phụ thuộc Prisma hay Nest.** Không import `@prisma/client` vào package này.
3. Kiểu response mô tả **hình dạng JSON sau khi serialize**: `Date` thành `string` ISO. `UserListItem.lastLoginAt` là `string | null`, không phải `Date`.

## Tiêu chí nghiệm thu (Given/When/Then)

### AC1 — Kiểu dùng chung tồn tại và được export
- **Given** `packages/shared-types`
- **When** tôi import `CreateUserRequest`, `CreateUserResponse`, `UserListItem`, `ListUsersQuery` từ `@cms/shared-types`
- **Then** import thành công, không cần trỏ đường dẫn sâu vào file

### AC2 — BE bị compiler ràng buộc vào hợp đồng
- **Given** `CreateUserDto implements CreateUserRequest`
- **When** ai đó xoá trường `phone` khỏi `CreateUserRequest` mà không sửa DTO (hoặc ngược lại)
- **Then** `pnpm --filter api lint` **fail**
- **And** hàm `UsersService.list` có kiểu trả về khai tường minh là `Promise<UserListItem[]>`, `create` là `Promise<CreateUserResponse>`

### AC3 — FE dùng kiểu dùng chung, không khai lại
- **Given** `apps/web/src/features/users/users-page.tsx`
- **When** tôi tìm `interface UserRow`
- **Then** nó **không còn tồn tại**; màn dùng `UserListItem` import từ `@cms/shared-types`
- **And** popup tạo người dùng gửi body có kiểu `CreateUserRequest`

### AC4 — Lệch hợp đồng bị bắt ngay khi build
- **Given** toàn bộ đã refactor
- **When** tôi thêm một trường vào `UserListItem` mà `USER_SELECT` không trả
- **Then** `pnpm --filter api lint` fail (không im lặng cho qua)

### AC5 — Không hồi quy hành vi
- **Given** toàn bộ test của `US-USERS-01` (BE Jest/Supertest + FE Vitest)
- **When** chạy lại sau refactor
- **Then** **tất cả pass, không sửa một dòng test nào** để cho qua
- **And** response JSON thực tế của `POST /users` và `GET /users` giống y hệt trước refactor (so sánh bằng test, không bằng mắt)

## Ca phân quyền

Story này **không đổi hành vi phân quyền**. Bảng dưới là bảng của `US-USERS-01`, dùng làm mốc hồi quy — sau refactor phải vẫn đúng từng ô:

| Vai trò | `GET /users` | `POST /users` trong phòng được gán | `POST /users` ở phòng khác | Tạo vai trò `ADMIN` |
|---|---|---|---|---|
| **Super Admin** (`global`) | ✅ toàn công ty | ✅ 201 | ✅ 201 | ✅ 201 |
| **Admin** (phòng được gán) | ✅ phòng mình | ✅ 201 | ❌ **403** | ❌ **403** |
| **Admin ở phòng KHÔNG được gán** | ✅ nhưng không thấy người của phòng đó | — | ❌ **403** | ❌ **403** |
| **User** | ✅ phòng mình (chỉ đọc) | ❌ **403** | ❌ **403** | ❌ **403** |
| **Intern** | ❌ **403** | ❌ **403** | ❌ **403** | ❌ **403** |

Ca bắt buộc giữ nguyên sau refactor: **Admin phòng Audio gọi `POST /users` với `departmentId` của Marketing → 403**, và **User có token hợp lệ gọi `POST /users` → 403 (không phải 401)**.

## Phụ thuộc

- **Phải làm sau khi `US-USERS-01` merge xong** (cả BE-01, FE-01, TEST-01). Làm song song sẽ xung đột trực tiếp trên `dto.ts`, `users.service.ts`, `users-page.tsx`.
- Cần test của TEST-01 đã có và đang xanh để làm mốc hồi quy cho AC5. Không có test thì không nhận story này.

## Task

### BE-02 — Khai kiểu dùng chung và ràng buộc backend
- Thêm `packages/shared-types/src/users.ts`: `UserStatus`, `LockedReason`, `CreateUserRequest`, `CreateUserResponse`, `UserListItem`, `ListUsersQuery`. Export qua `index.ts`.
- `CreateUserDto implements CreateUserRequest`; giữ nguyên decorator class-validator.
- Khai kiểu trả về tường minh cho `UsersService.list` và `UsersService.create`.
- **Không** đổi `USER_SELECT` ngoài việc làm nó khớp `UserListItem`.

### FE-02 — Bỏ kiểu khai cục bộ
- Xoá `interface UserRow`, dùng `UserListItem`.
- Body submit của popup tạo người dùng gắn kiểu `CreateUserRequest`.
- Không đổi giao diện, không đổi hành vi.

### TEST-02 — Hồi quy
- Chạy lại toàn bộ test `US-USERS-01`, không sửa test.
- Thêm một test so sánh **khoá của object JSON** mà `GET /users` và `POST /users` trả về, để lần sau đổi `select` mà quên đổi kiểu thì test đỏ chứ không lặng lẽ qua.

## Ghi chú cho FE / BE

**BE:** `implements` chỉ bắt thiếu/sai kiểu trường, **không** bắt được trường thừa trong DTO. Nếu muốn chặt hơn thì thêm một dòng kiểm kiểu (`satisfies`) hoặc một test so khoá — đừng tin mỗi `implements`.

**FE:** Đừng "tiện tay" đổi luôn `DepartmentRow` — đã cố ý để ngoài phạm vi, sẽ thành PR hai module. Nếu thấy chỗ khác cũng khai kiểu cục bộ thì báo lại để mở story, không tự mở rộng phạm vi.

**Cả hai:** story này giá trị nằm ở chỗ *compiler phải fail khi hợp đồng lệch*. Refactor xong mà cố tình đổi tên trường cả hai bên vẫn build xanh thì coi như chưa đạt — hãy thử phá một trường để chứng minh AC2/AC4 thật sự hoạt động, rồi hoàn tác.
