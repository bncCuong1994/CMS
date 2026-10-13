# US-ATT-01 Dựng app Expo và đăng nhập trên mobile

Vai trò: Admin | User | Intern (Super Admin đăng nhập được nhưng không chấm công)
Là nhân sự dùng điện thoại, tôi muốn đăng nhập vào app chấm công bằng chính tài khoản CMS để sau đó chấm công, mà không cần tài khoản riêng.
Module: auth (app mới `apps/mobile`)
Giai đoạn: 6
Quyền cần: không (đăng nhập mở cho mọi vai trò có tài khoản `active`)  Phạm vi: —

## Mục tiêu của story này (nền tảng — cố ý hẹp)

Đây là story **hạ tầng mobile**, chưa có nghiệp vụ chấm công. Phạm vi đúng bằng:
1. Dựng app `apps/mobile` bằng **React Native + Expo (TypeScript)** trong monorepo pnpm, dùng chung `packages/shared-types`.
2. Màn **Đăng nhập** gọi `POST /auth/login` hiện có, lưu token an toàn bằng `expo-secure-store`.
3. **Tự làm mới token** (refresh) và **đăng xuất**.
4. Một màn **Trang chủ rỗng** sau đăng nhập, chỉ hiện tên + vai trò + nút Đăng xuất (chỗ cho nút Chấm công của `US-ATT-04` sau này).

**KHÔNG** làm trong story này: chấm công, Face ID, GPS, device binding (để `US-ATT-02`+). Face ID ở đây **không** dùng; sinh trắc chỉ xuất hiện từ `US-ATT-04`.

## Giả định (ghi rõ để dễ đổi)

1. **Đăng nhập dùng chung tài khoản web**, không có luồng đăng ký trên mobile. Tài khoản do Admin/Super Admin tạo như hiện tại.
2. **Super Admin đăng nhập được** vào app (để kiểm thử/giám sát) nhưng Trang chủ **không** có nút chấm công — vì `SUPER_ADMIN` không có `attendance.punch` (sẽ kiểm ở `US-ATT-04`). Story này chỉ cần đăng nhập thành công.
3. Tài khoản `locked`/`inactive` **không đăng nhập được** — hành vi do backend `auth` quyết định, FE mobile chỉ hiển thị lỗi.
4. Token lưu bằng `expo-secure-store` (Keychain trên iOS), **không** lưu `AsyncStorage` thường.
5. **Chưa làm** đăng nhập sinh trắc để mở lại app (biometric unlock app) — ghi là nợ, không thuộc story này.
6. `API_BASE_URL` cấu hình qua biến môi trường Expo (`app.config.ts` / `EXPO_PUBLIC_API_URL`), **không** hard-code. Dev chạy máy thật cần IP LAN của máy chạy API, không phải `localhost`.

## Tiêu chí nghiệm thu (Given/When/Then)

### AC1 — Màn đăng nhập
- **Given** tôi mở app lần đầu (chưa có token hợp lệ)
- **When** app khởi động
- **Then** hiện màn Đăng nhập với trường Email, Mật khẩu (ẩn/hiện), nút Đăng nhập

### AC2 — Đăng nhập thành công
- **Given** tôi nhập email + mật khẩu đúng của một tài khoản `active`
- **When** tôi bấm Đăng nhập
- **Then** app gọi `POST /auth/login`, lưu access + refresh token vào `expo-secure-store`
- **And** chuyển sang Trang chủ, hiện họ tên + vai trò của tôi (đọc từ `GET /auth/me`)

### AC3 — Sai thông tin đăng nhập
- **Given** tôi nhập sai mật khẩu
- **When** tôi bấm Đăng nhập
- **Then** hiện lỗi "Email hoặc mật khẩu không đúng" (theo `message` backend trả), **không** lưu token, ở lại màn đăng nhập

### AC4 — Tài khoản bị khoá
- **Given** tài khoản của tôi ở trạng thái `locked` (ví dụ Intern bị `inactive_30d`)
- **When** tôi đăng nhập đúng mật khẩu
- **Then** backend trả lỗi phù hợp, app hiện thông báo tài khoản bị khoá, không vào Trang chủ

### AC5 — Giữ phiên khi mở lại app
- **Given** tôi đã đăng nhập và đóng app
- **When** tôi mở lại app và access token còn hạn
- **Then** vào thẳng Trang chủ, **không** bắt đăng nhập lại

### AC6 — Tự làm mới token
- **Given** access token đã hết hạn nhưng refresh token còn hạn
- **When** app gọi một API bất kỳ nhận `401`
- **Then** app tự gọi refresh **một lần**, lấy token mới rồi thử lại request; thất bại thì xoá token + về màn Đăng nhập
- **Lưu ý:** áp dụng đúng quy ước đã chốt cho web (`US-WEB-01`): 401 → refresh 1 lần; 403 → **không** xoá phiên.

### AC7 — Đăng xuất
- **Given** tôi ở Trang chủ
- **When** tôi bấm Đăng xuất
- **Then** app thu hồi refresh token ở backend (nếu có endpoint), xoá token khỏi `expo-secure-store`, về màn Đăng nhập

### AC8 — Không rò token
- Token **không** được log ra console/Flipper; không lưu ở nơi không mã hoá.

## Ca phân quyền

Đăng nhập không gắn quyền nghiệp vụ; "ai được vào" phụ thuộc trạng thái tài khoản, không phụ thuộc vai trò. Bảng cho đủ 4 vai trò + ca Admin phòng không được gán để đồng bộ mẫu:

| Vai trò / tình huống | Đăng nhập app mobile | Thấy nút Chấm công ở Trang chủ (chuẩn bị cho US-ATT-04) |
|---|---|---|
| **Super Admin** | ✅ vào được | ❌ không (không có `attendance.punch`) |
| **Admin** (phòng được gán) | ✅ | ✅ (sẽ bật ở US-ATT-04) |
| **Admin ở phòng KHÔNG được gán** | ✅ (đăng nhập không theo phòng) | Chấm công của **chính Admin đó** (own) — không liên quan phạm vi phòng; phạm vi phòng chỉ tính khi *xem báo cáo/duyệt* ở story sau |
| **User** | ✅ | ✅ |
| **Intern** (`active`) | ✅ | ✅ |
| **Intern** (`locked`/`inactive`) | ❌ backend chặn | — |
| **Chưa đăng nhập / token hỏng** | màn Đăng nhập | — |

Ca bắt buộc có test: **đăng nhập sai mật khẩu → không lưu token**; **tài khoản `locked` → không vào được**; **401 khi gọi API → refresh 1 lần rồi retry, thất bại thì về Đăng nhập**.

## API contract — ĐÃ XÁC NHẬN từ code (be-dev, 2026-10-12)

Tất cả endpoint đã tồn tại, prefix `/api/v1` (`apps/api/src/main.ts`). Kiểu dùng chung đã có sẵn trong `packages/shared-types/src/auth.ts` → **mobile import, không khai lại.**

### `POST /api/v1/auth/login` (public)
**Request**: `{ "email": "...", "password": "..." }`
**Response `200`**: `{ accessToken, refreshToken, user }` — trong đó **`user` là `MeResponse` đầy đủ** (`{ id, email, fullName, roles[], grants }`), **không** phải `{ id, fullName, role }`. → Đăng nhập xong có luôn `grants`, không cần gọi `/auth/me` ngay.
| Mã lỗi | Khi nào | Message |
|---|---|---|
| `401` | sai email/mật khẩu | `Email hoặc mật khẩu không đúng` |
| `401` | tài khoản **không `active`** (cả `locked` lẫn `inactive`) | `Tài khoản đã bị khoá` |

→ locked/inactive trả **`401`**, không phải 403. Message giống nhau, app chỉ cần hiển thị `message` backend trả.

### `POST /api/v1/auth/refresh` (public)
**Request**: `{ "refreshToken": "..." }` → **Response `200`**: `{ accessToken, refreshToken }` (KHÔNG có `user`).
⚠️ **Refresh token xoay vòng**: mỗi lần refresh, token cũ bị thu hồi và cấp cặp mới → mobile phải **lưu đè cả `accessToken` lẫn `refreshToken` mới** vào secure-store. Lỗi `401` nếu token không tồn tại / đã thu hồi / hết hạn / user không `active`.

### `POST /api/v1/auth/logout` (public)
**Request**: `{ "refreshToken": "..." }` → **Response `204`** (không body), thu hồi đúng refresh token đó. Không ném lỗi kể cả token không khớp.

### `GET /api/v1/auth/me` (Bearer)
**Response `200`**: `MeResponse` = `{ id, email, fullName, roles: UserRoleAssignment[], grants: PermissionGrants }`.
- `PermissionGrants` = `{ global: Permission[]; departments: Record<deptId, Permission[]> }` — **đây là hình dạng grants THẬT** (không phải mảng `{ code, scopes[] }`).
- Ẩn/hiện nút bằng helper có sẵn `hasPermission(grants, permission, departmentId?)`.
- Dùng khi mở lại app để làm tươi grants.

### Kiểu dùng chung (có sẵn, import từ `@cms/shared-types`)
`LoginResponse`, `MeResponse`, `UserRoleAssignment`, `PermissionGrants`, `RoleCode`, `Permission`, `hasPermission`, `departmentsWithPermission`. Response của `/auth/refresh` chưa có type riêng → dùng `Pick<LoginResponse, 'accessToken' | 'refreshToken'>`.

## Cấu trúc `apps/mobile` (Expo + expo-router)

```
apps/mobile/
├─ app.config.ts          # đọc EXPO_PUBLIC_API_URL, KHÔNG hard-code URL
├─ package.json
├─ tsconfig.json          # extends base, path alias @cms/shared-types
├─ metro.config.js        # ⚠️ monorepo pnpm: watchFolders = gốc workspace + nodeModulesPaths, resolve packages/
├─ babel.config.js
├─ .env.example           # EXPO_PUBLIC_API_URL=http://<IP-LAN>:3000
├─ app/                   # expo-router (file-based)
│  ├─ _layout.tsx         # QueryClientProvider + nạp phiên từ secure-store + auth gate
│  ├─ index.tsx           # có token → /home, chưa có → /login
│  ├─ (auth)/login.tsx    # màn Đăng nhập
│  └─ (app)/_layout.tsx   # chặn nếu chưa đăng nhập
│     └─ (app)/home.tsx   # Trang chủ rỗng: tên + vai trò + Đăng xuất (chừa chỗ nút Chấm công US-ATT-04)
└─ src/
   ├─ lib/{http.ts, secure-store.ts, query-client.ts}
   ├─ features/auth/{auth-store.ts, use-login.ts, use-logout.ts, use-me.ts, login-form.tsx}
   └─ components/         # Button, Input, FormField…
```

**Bám quy ước:** dùng chung kiểu từ `@cms/shared-types`; xử lý lỗi giống web (`US-WEB-01`); token chỉ ở `expo-secure-store`; `metro.config.js` xử lý monorepo ngay từ đầu.

## Phụ thuộc

- `apps/api` module `auth` — đã có (`POST /auth/login`, refresh, `/auth/me`). **Cần BE xác nhận contract thật**, nếu thiếu endpoint refresh/logout thì mở rõ trong task BE.
- `packages/shared-types` — tái dùng kiểu `Role`, `Permission`, `grants`. Nếu login response/`/auth/me` chưa có kiểu trong shared-types thì bổ sung ở đó (không khai lại trong `apps/mobile`).
- Expo SDK, `expo-router` (điều hướng), `expo-secure-store`. Thêm `apps/mobile` vào `pnpm-workspace.yaml`.

## Task

### BE-01 — Xác nhận/mở hợp đồng auth cho mobile
- Đọc `apps/api/src/modules/auth`, xác nhận path + request/response thật của `login`, `refresh`, `me`, và hành vi với tài khoản `locked`/`inactive`.
- Nếu **chưa có** endpoint refresh hoặc logout (thu hồi refresh token) thì báo lại BA để quyết mở trong story này hay story riêng — **không tự mở rộng** ngoài phạm vi.
- Nếu kiểu login/`me` chưa nằm trong `packages/shared-types` thì đưa vào đó để mobile + web + api dùng chung.
- **Không** sửa logic bảo mật hiện có.

### FE-01 (mobile) — Dựng `apps/mobile` + luồng đăng nhập
- Khởi tạo Expo app TypeScript trong `apps/mobile`, nối vào pnpm workspace, dùng `packages/shared-types`.
- HTTP client có interceptor theo đúng quy ước web (`US-WEB-01`): chuẩn hoá lỗi; 401 → refresh 1 lần rồi retry; 403 → không xoá phiên; ưu tiên `message` backend. ⚠️ **Loại trừ `/auth/login` và `/auth/refresh` khỏi luồng auto-refresh** (401 từ chính hai path này là đăng nhập sai / refresh hỏng → hiện lỗi, không retry, tránh lặp vô hạn). Refresh thành công phải **lưu đè cả hai token mới** (token xoay vòng).
- Màn Đăng nhập (react-hook-form + zod hoặc tương đương), lưu token bằng `expo-secure-store`.
- Điều hướng: chưa có token hợp lệ → Đăng nhập; có → Trang chủ. Trang chủ hiện tên + vai trò + nút Đăng xuất.
- `API_BASE_URL` qua `EXPO_PUBLIC_API_URL`, không hard-code.

### TEST-01 — Kiểm thử mobile
- Unit/component: đăng nhập thành công lưu token; sai mật khẩu không lưu token + hiện lỗi; tài khoản khoá hiện lỗi; interceptor 401 refresh-1-lần rồi retry, thất bại thì clear + về Đăng nhập; đăng xuất xoá token.
- Chọn runner hợp Expo (Jest + React Native Testing Library). Mock lớp HTTP, không gọi backend thật trong unit.
- (E2E Detox/Maestro để story sau khi có luồng chấm công thật — ghi là nợ, không làm ở đây.)

## Ghi chú cho FE / BE

**BE:** Bảo mật vẫn ở backend. Mobile chỉ là một client khác của cùng API — không nới lỏng gì cho mobile. Không ghi `activity_events` cho hành vi đăng nhập ngoài những gì `auth` đã làm cho web.

**FE (mobile):** Tái dùng tối đa quy ước đã chốt ở `US-WEB-01` (xử lý lỗi, 401 vs 403) để hai client hành xử giống nhau. Token chỉ ở `expo-secure-store`. Đây là nền; đừng kéo nghiệp vụ chấm công/Face ID/GPS vào — đã có story riêng.
