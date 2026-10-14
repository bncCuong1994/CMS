# US-ATT-03 Cấu hình chấm công trên web (lịch làm việc cố định + điểm văn phòng/geofence)

Vai trò: Super Admin (ghi) · Admin, User (chỉ xem)
Là Super Admin, tôi muốn cấu hình lịch làm việc cố định của công ty (giờ vào/ra, nghỉ trưa, ngày làm việc, quota đi muộn) và khai các điểm văn phòng kèm bán kính geofence, để lõi chấm công mobile (US-ATT-04) biết được phép bấm ở đâu và tính đi muộn/về sớm theo khung nào.
Là Admin/User, tôi muốn **xem** lịch làm việc chung và các điểm văn phòng (chỉ đọc), để biết giờ chuẩn và nơi được phép chấm công mà không sửa được cấu hình.
Module: attendance (mới) — màn cấu hình trên `apps/web`
Giai đoạn: 6
Quyền cần: `attendance.config` (ghi, phạm vi `global`) · `attendance.config_read` (xem) — Phạm vi: `global`

## Mục tiêu của story (cố ý hẹp)

1. Hai quyền trong `@cms/shared-types`:
   - `attendance.config` (global) = **ghi** cấu hình → tự thuộc Super Admin (qua `ALL_PERMISSIONS`), **không** thuộc Admin/User/Intern.
   - `attendance.config_read` = **xem** cấu hình → gán cho **Admin** và **User** trong seed; Super Admin tự có qua `ALL_PERMISSIONS`. **Không** thuộc Intern.
2. Model + migration: `attendance_settings` (cấu hình đơn — **singleton toàn hệ thống**, chứa lịch làm việc cố định) và `office_locations` (nhiều điểm).
3. API cấu hình: **GET** đọc lịch + điểm (cần `attendance.config_read`); **ghi** (PATCH settings, CRUD `office_locations`) chỉ Super Admin (`attendance.config`, globalOnly).
4. Màn cấu hình trên `apps/web`: lịch làm việc cố định + danh sách điểm văn phòng. Super Admin sửa được; Admin/User mở ở chế độ **read-only**.

**KHÔNG** làm trong story này: bấm chấm công / Face ID / GPS phía mobile (US-ATT-04); **tính** số phút đi muộn/về sớm (US-ATT-04 dùng cấu hình này để tính); quy đổi phút vượt quota → tiền lương (story lương riêng, chưa có); chế độ ca (US-ATT-05 — **đã hoãn**).

> **Cập nhật phân quyền (2026-10-14):** mở quyền **xem** cấu hình cho Admin + User (read-only). Trước đây chỉ Super Admin truy cập (xem `docs/decisions.md`).

## Quyết định nền (xem `docs/decisions.md`, 2026-10-13)

- **Mô hình giờ hành chính cố định (A)**, KHÔNG có `attendance_mode` `hourly|shift`.
- **Lịch chung toàn công ty** (một bản ghi), chưa hỗ trợ lịch riêng theo phòng.
- **Đi muộn tính chặt**: muộn = số phút chấm-vào trễ hơn giờ vào chuẩn (không dung sai theo lần chấm).
- **Quota 60 phút đi muộn/tháng mỗi user** (cấu hình được); vượt → trừ lương (tính sau).
- **Múi giờ cố định `Asia/Ho_Chi_Minh`**.
- Geofence: bán kính mặc định 150 m (20–5000), nhiều điểm, xoá mềm.

## Giả định (ghi rõ để dễ đổi)

1. `attendance_settings` là **một bản ghi duy nhất**. Chưa cấu hình → API trả **mặc định**: giờ vào `08:00`, giờ ra `17:00`, nghỉ trưa `12:00–13:00`, ngày làm việc T2–T6, quota muộn `60` phút, múi giờ `Asia/Ho_Chi_Minh`, danh sách điểm rỗng.
2. Giờ lưu dạng **"HH:mm"** (giờ treo tường theo múi giờ công ty), validate đúng định dạng + hợp lệ (0–23:0–59). Giờ ra phải **sau** giờ vào; nếu có nghỉ trưa thì `lunchStart < lunchEnd` và nằm trong [giờ vào, giờ ra].
3. **Nghỉ trưa có thể để trống** (công ty không khai nghỉ trưa) → không trừ.
4. Ngày làm việc lưu bằng **số thứ ISO** 1=T2 … 7=CN; chọn tập con; mặc định `[1,2,3,4,5]`.
5. Múi giờ: hiển thị cố định `Asia/Ho_Chi_Minh`, **chưa** cho đổi (hằng); để sẵn trường trong DB để sau mở rộng.
6. Xoá điểm văn phòng = **xoá mềm** (`deleted_at`); GET mặc định loại bản ghi đã xoá.
7. Toạ độ: `latitude` [-90,90], `longitude` [-180,180]; `Decimal(9,6)`.
8. Đổi lịch **không hồi tố**: bản ghi chấm công cũ giữ số phút muộn đã tính lúc tạo; lịch mới áp cho lần chấm sau (ghi chú định hướng cho US-ATT-04).

## Tiêu chí nghiệm thu (Given/When/Then)

### AC1 — Xem cấu hình hiện tại
- **Given** tôi là Super Admin mở màn "Cấu hình chấm công"
- **When** màn tải
- **Then** thấy lịch làm việc hiện tại (giờ vào/ra, nghỉ trưa, ngày làm việc, quota muộn, múi giờ) và danh sách điểm văn phòng. Chưa cấu hình → hiện bộ **mặc định** ở Giả định 1.

### AC2 — Lưu lịch làm việc
- **Given** tôi chỉnh giờ vào/ra, nghỉ trưa, ngày làm việc, quota muộn
- **When** bấm Lưu
- **Then** `PATCH /attendance/settings` trả `200`, màn cập nhật, ghi `audit_logs` (`attendance.settings.update`, kèm giá trị cũ → mới)

### AC3 — Thêm điểm văn phòng
- **Given** tôi mở form thêm điểm
- **When** nhập tên + lat + lng (bán kính trống → mặc định 150 m) và Lưu
- **Then** `POST /attendance/office-locations` trả `201`, điểm xuất hiện, ghi `audit_logs`

### AC4 — Sửa điểm văn phòng
- **When** tôi đổi tên/toạ độ/bán kính/bật-tắt và Lưu
- **Then** `PATCH /attendance/office-locations/:id` trả `200`, danh sách cập nhật, ghi `audit_logs`

### AC5 — Xoá mềm điểm văn phòng
- **When** tôi xoá một điểm
- **Then** `DELETE /attendance/office-locations/:id` trả `204`, điểm biến khỏi danh sách (set `deleted_at`), **không** mất khỏi DB; ghi `audit_logs`

### AC6 — Validate đầu vào
- Giờ đúng "HH:mm"; giờ ra > giờ vào; nghỉ trưa (nếu có) hợp lệ và nằm trong giờ làm; `monthlyLateAllowanceMin` ≥ 0; ngày làm việc là tập con của 1–7, không rỗng.
- Điểm: tên không rỗng; `latitude` [-90,90]; `longitude` [-180,180]; `radiusM` [20,5000].
- Sai → `400` message tiếng Việt rõ ràng; FE validate trước bằng zod cho khớp.

### AC7 — Phân quyền đọc/ghi tách bạch
- **Đọc** (`GET /attendance/settings`): cho role có `attendance.config_read` → Super Admin, Admin, User. Intern → `403`.
- **Ghi** (`PATCH /attendance/settings`, `POST/PATCH/DELETE /attendance/office-locations/*`): chỉ role có `attendance.config` (global) → **chỉ Super Admin**. Admin/User/Intern → `403` (dù GET được). FE ẩn menu/màn này với người không có quyền đọc (chỉ để trải nghiệm; chặn thật ở backend).

### AC8 — Admin/User xem read-only
- **Given** tôi là Admin hoặc User (có `attendance.config_read`, **không** có `attendance.config`)
- **When** mở màn "Cấu hình chấm công"
- **Then** thấy đầy đủ lịch làm việc + danh sách điểm văn phòng nhưng **mọi input disabled**, **không có** nút Lưu / Thêm / Sửa / Xoá; có chú thích "Chỉ Super Admin được chỉnh cấu hình". Nếu cố gọi API ghi (vd qua devtools) → backend trả `403`.

## Ca phân quyền (bắt buộc đủ 4 vai trò + Admin phòng không được gán)

| Vai trò / tình huống | GET (đọc) | PATCH/POST/DELETE (ghi) | Màn "Cấu hình chấm công" |
|---|---|---|---|
| **Super Admin** | ✅ (`attendance.config_read` qua ALL) | ✅ (`attendance.config` global) | ✅ chỉnh được |
| **Admin** (phòng được gán) | ✅ (`attendance.config_read`) | ❌ `403` | ✅ read-only |
| **Admin ở phòng KHÔNG được gán** | ✅ (quyền đọc là `global`, không phụ thuộc phòng) | ❌ `403` | ✅ read-only |
| **User** | ✅ (`attendance.config_read`) | ❌ `403` | ✅ read-only |
| **Intern** | ❌ `403` | ❌ `403` | ❌ ẩn |
| **Chưa đăng nhập** | `401` | `401` | về `/login` |

> Ghi chú scope: `attendance.config_read` mô tả cấu hình **toàn công ty** (singleton, không có chiều phòng ban) nên GET **không** lọc/chặn theo phòng — mọi Admin/User đọc cùng một bản ghi. Vì vậy "Admin ở phòng không được gán" vẫn đọc được (không có tài nguyên theo phòng để chặn), nhưng **tuyệt đối không ghi** được.

Ca bắt buộc có test: **Super Admin lưu lịch + CRUD điểm OK**; **Admin & User GET OK (200) nhưng mọi endpoint ghi → 403**; **Intern GET + ghi đều → 403**; **validate giờ/toạ độ/bán kính/ngày làm việc sai → 400**; **xoá mềm giữ bản ghi + loại khỏi GET**; **audit_logs được ghi cho mỗi thao tác ghi**.

## API contract (dự kiến — be-dev xác nhận & điều chỉnh khi làm)

Prefix `/api/v1`. Guard **theo từng nhóm endpoint** (KHÔNG đặt chung một guard ghi cho cả controller):
- **GET** → `@RequirePermission(PERMISSIONS.ATTENDANCE_CONFIG_READ)` (không `globalOnly`; singleton không có chiều phòng ban nên không lọc theo phòng).
- **PATCH settings + POST/PATCH/DELETE office-locations** → `@RequirePermission(PERMISSIONS.ATTENDANCE_CONFIG, { globalOnly: true })`.

### `GET /api/v1/attendance/settings`
```
200 {
  "workStart": "08:00",
  "workEnd": "17:00",
  "lunchStart": "12:00" | null,
  "lunchEnd": "13:00" | null,
  "workDays": [1,2,3,4,5],
  "monthlyLateAllowanceMin": 60,
  "timezone": "Asia/Ho_Chi_Minh",
  "officeLocations": [
    { "id": "uuid", "name": "...", "latitude": 10.776, "longitude": 106.700,
      "radiusM": 150, "isActive": true }
  ]
}
```
Chưa cấu hình → trả bộ mặc định (Giả định 1) + `officeLocations: []`. `403` nếu không có `attendance.config_read` (Intern).

### `PATCH /api/v1/attendance/settings`
Request (các trường tuỳ chọn, chỉ gửi trường đổi):
`{ workStart?, workEnd?, lunchStart?|null, lunchEnd?|null, workDays?, monthlyLateAllowanceMin? }`
→ `200` cấu hình mới. Upsert bản ghi singleton. Ghi `audit_logs`.
| Mã lỗi | Khi nào |
|---|---|
| `400` | giờ sai định dạng / giờ ra ≤ giờ vào / nghỉ trưa không hợp lệ / workDays rỗng hoặc ngoài 1–7 / quota < 0 |
| `403` | không có `attendance.config` |

### `POST /api/v1/attendance/office-locations`
`{ name, latitude, longitude, radiusM? }` (thiếu `radiusM` → 150) → `201`. Ghi `audit_logs`.

### `PATCH /api/v1/attendance/office-locations/:id`
`{ name?, latitude?, longitude?, radiusM?, isActive? }` → `200`; `404` nếu không tồn tại/đã xoá mềm. Ghi `audit_logs`.

### `DELETE /api/v1/attendance/office-locations/:id`
Xoá mềm → `204`; `404` nếu không tồn tại/đã xoá. Ghi `audit_logs`.

Kiểu request/response đưa vào `@cms/shared-types` (`AttendanceSettings`, `OfficeLocation`, và DTO tương ứng) → web + api + mobile (US-ATT-04) dùng chung, **không khai lại**.

## Phụ thuộc

- `rbac` guard `@RequirePermission` + `{ globalOnly: true }` — đã có (mẫu `departments.controller.ts`).
- `audit` service ghi `audit_logs` — đã có.
- **Migration** mới: `attendance_settings`, `office_locations`.
- Thêm quyền `attendance.config` vào `permissions.ts` + chạy lại seed roles.

## Task

### BE-01 — Model, migration, quyền
- `packages/shared-types/src/permissions.ts`:
  - Giữ `ATTENDANCE_CONFIG: 'attendance.config'` + mô tả "Cấu hình chấm công" (ghi).
  - Thêm `ATTENDANCE_CONFIG_READ: 'attendance.config_read'` + mô tả "Xem cấu hình chấm công".
- `packages/shared-types/src/roles.ts`: thêm `P.ATTENDANCE_CONFIG_READ` vào mảng `permissions` của **ADMIN** và **USER**. KHÔNG thêm `attendance.config` cho bất kỳ role nào ngoài Super Admin. Intern không có cả hai. Super Admin có cả hai qua `ALL_PERMISSIONS`.
- Chạy lại seed roles + migration chèn `permissions` (`attendance.config_read`) và `role_permissions` (gán cho ADMIN, USER) để DB khớp seed.
- Prisma: `AttendanceSettings` (singleton: id, workStart String "HH:mm", workEnd String, lunchStart String?, lunchEnd String?, workDays Int[], monthlyLateAllowanceMin Int default 60, timezone String default 'Asia/Ho_Chi_Minh', timestamps) và `OfficeLocation` (id, name, latitude Decimal(9,6), longitude Decimal(9,6), radiusM Int default 150, isActive Bool default true, deletedAt, timestamps). Migration `attendance_config`.
- Kiểu dùng chung vào `@cms/shared-types`.

### BE-02 — Module `attendance` (NestJS)
- Controller + service + DTO, toàn bộ endpoint trên. Guard **tách theo nhóm**: GET dùng `attendance.config_read` (không globalOnly); các endpoint ghi dùng `attendance.config` globalOnly.
- `ValidationPipe` theo AC6 (định dạng giờ, thứ tự giờ, nghỉ trưa, workDays, quota, lat/lng/radius). Message tiếng Việt.
- `attendance_settings` upsert singleton (đừng tạo nhiều dòng). GET chưa có → trả mặc định.
- Xoá mềm `deleted_at`; GET loại bản ghi đã xoá.
- Ghi `audit_logs` cho MỌI thao tác ghi, trong cùng transaction với thay đổi dữ liệu (xem cách users/departments ghi audit).
- KHÔNG truy vấn thẳng bảng module khác; KHÔNG nới lỏng bảo mật.

### FE-01 (web) — Màn cấu hình chấm công
- Route mới (vd `/settings/attendance`), hiện với người có **`attendance.config_read`** (đọc) HOẶC `attendance.config` (ghi). Cập nhật `use-can-config-attendance.ts` trả hai cờ: `canReadConfig` (hiện màn + menu) và `canWriteConfig` (bật nút sửa). Menu/route guard dùng `canReadConfig`.
- Phần 1 — **Lịch làm việc**: giờ vào/ra (time input), nghỉ trưa (có thể bỏ trống), chọn ngày làm việc (T2–CN), quota muộn (phút), hiển thị múi giờ cố định. Nút Lưu → `PATCH /attendance/settings`.
- Phần 2 — **Điểm văn phòng**: bảng + form thêm/sửa (tên, lat, lng, bán kính, bật/tắt) + xoá.
- **Chế độ read-only** khi `!canWriteConfig`: mọi input/control `disabled`; ẩn (không chỉ disable) nút Lưu, Thêm điểm, Sửa, Xoá, và nút mở dialog; hiện banner/chú thích "Chỉ Super Admin được chỉnh cấu hình". Không gọi mutation ở chế độ này.
- Validate zod khớp AC6; TanStack Query (invalidate sau mutation); xử lý lỗi theo `US-WEB-01` (toast mutation lỗi; 403 không đá phiên).
- Dùng kiểu từ `@cms/shared-types`, không khai lại.

### TEST-01 — Kiểm thử
- API (Jest + Supertest + Testcontainers): Super Admin lưu lịch + CRUD điểm OK; **Admin & User: GET → 200; mọi endpoint ghi (PATCH settings, POST/PATCH/DELETE office-locations) → 403**; **Intern: GET và ghi đều → 403**; validate sai (giờ/thứ tự/nghỉ trưa/workDays/toạ độ/bán kính) → 400; xoá mềm giữ bản ghi + loại khỏi GET; `audit_logs` ghi cho mỗi thao tác ghi; GET khi chưa cấu hình trả mặc định đúng.
- FE (Vitest): form validate; ẩn màn với người không có `attendance.config_read` (Intern); **read-only khi chỉ có quyền đọc — input disabled, không có nút Lưu/Thêm/Sửa/Xoá**; chế độ ghi (Super Admin) gọi đúng endpoint; hiển thị lỗi.

## Ghi chú cho FE / BE

**BE:** Bảo mật ở backend. `attendance.config` là `global` → không gắn scope department. Mọi thao tác ghi vào `audit_logs` (rule bất biến số 5). Lưu giờ dạng "HH:mm" treo tường; việc quy ra mốc thời gian thực theo `Asia/Ho_Chi_Minh` để **tính muộn/sớm** là của US-ATT-04 — story này chỉ lưu cấu hình.

**FE:** Ẩn menu/read-only chỉ để trải nghiệm — backend vẫn chặn ghi bằng `attendance.config` globalOnly. Map picker chọn toạ độ **không bắt buộc** (nhập tay lat/lng là đủ); thêm map coi là cải tiến. Chuẩn bị dữ liệu để US-ATT-04 (mobile) đọc `GET /attendance/settings` kiểm geofence và tính muộn/sớm.

**Phân quyền (2026-10-14):** tách **đọc** (`attendance.config_read` — Super Admin/Admin/User) khỏi **ghi** (`attendance.config` — chỉ Super Admin). Intern không có quyền nào. Guard GET **không** globalOnly và **không** lọc theo phòng (singleton toàn công ty).
