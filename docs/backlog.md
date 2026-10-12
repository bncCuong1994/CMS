# Backlog

Thứ tự làm theo giai đoạn trong `docs/ke-hoach-kien-truc.md`. **Không kéo việc giai đoạn sau lên khi nền tảng chưa xong.**

Trạng thái: `Chưa làm` → `Đang làm` → `Chờ review` → `Xong`

## Giai đoạn 1 — Nền tảng

| Mã | Tiêu đề | Trạng thái | Ghi chú |
|---|---|---|---|
| — | Dựng khung monorepo, API NestJS, web React, phân quyền cơ bản | Xong | commit `efa3172`, PR #2 |

## Giai đoạn 2 — Người dùng & phân quyền

| Mã | Tiêu đề | Trạng thái | Ghi chú |
|---|---|---|---|
| `US-USERS-01` | Tạo tài khoản người dùng từ màn Người dùng | **Chờ merge** | BE-01, FE-01, TEST-01 xong; review đã xử lý hết góp ý MEDIUM/LOW. Nhánh `feat/users-create-user`, chưa commit. Kiểm chứng 2026-10-12: api `lint`/`lint:test`/`test` 9/9/`test:e2e` **57/57**/`build`, web `lint`/`test` **16/16**/`build` — tất cả xanh. |
| `US-USERS-02` | Chuẩn hoá kiểu request/response module users vào shared-types | Chưa làm | Nợ kỹ thuật. **Chặn:** phải sau khi `US-USERS-01` merge và test TEST-01 xanh. |

### Việc còn treo của `US-USERS-01`

| Việc | Trạng thái |
|---|---|
| Thêm bước `pnpm --filter api --if-present run lint:test` vào `.github/workflows/ci.yml` (giữa bước `Lint` và `Typecheck và build`, kèm `if: steps.src.outputs.present == 'true'`) | **Chưa làm** — hook `guard-paths.mjs` chặn cả `be-dev` và `ba-pm` sửa `.github/`. Cần người dùng sửa tay hoặc cấp quyền. Không có bước này thì `test/` vẫn không được typecheck trên CI. |

### Chưa viết story (đã nhận diện, chờ xếp thứ tự)

| Việc | Vì sao cần | Độ ưu tiên |
|---|---|---|
| Sửa thông tin người dùng (gồm **gán nhiều phòng ban**) | `US-USERS-01` cố ý chỉ gán một phòng khi tạo; kế hoạch cho phép Admin thuộc nhiều phòng | Cao |
| Khoá / mở khoá tài khoản thủ công (`locked_reason = 'manual'`) | Nghiệp vụ cốt lõi, chưa có endpoint | Cao |
| Chuyển Intern → User giữ nguyên lịch sử | Nghiệp vụ cốt lõi | Cao |
| Job tự khoá Intern sau 30 ngày không hoạt động + thông báo Admin phòng | Cần `activity_events` ghi đủ trước | Cao |
| Màn ma trận quyền cho Super Admin | Khi có màn này thì quyền xem trước trong popup tạo người dùng **phải** đổi từ `DEFAULT_ROLES` sang `GET /roles` (xem `docs/decisions.md`) | Trung bình |
| Nợ kỹ thuật: `DepartmentRow` ở `apps/web/src/features/departments/departments-page.tsx:5` khai kiểu cục bộ | Cùng loại lỗi với `US-USERS-02` nhưng thuộc module `departments`; cố ý tách để một PR không đụng hai module | Trung bình |
| **Phân trang `GET /api/v1/users`** (`users.service.ts:37-44` dùng `findMany` không `take`/`skip`) | Có từ giai đoạn 1. Bảng lớn sẽ kéo cả bộ về client. Phát hiện khi review `US-USERS-01`. | Cao |
| **Email của user đã xoá mềm không tái dùng được** (`users.service.ts:61` dùng `findUnique` không loại `deletedAt != null`) | Admin xoá người rồi tạo lại cùng email sẽ nhận `409 Email đã được sử dụng` mà không hiểu vì sao. Cột `email` là `@unique` thật nên cần **quyết định nghiệp vụ**: đổi thông báo cho rõ, hay giải phóng email khi xoá mềm (vd đổi thành `<email>+deleted-<id>`). | Cao |
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
