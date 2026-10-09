---
name: pgboss-job
description: Viết job định kỳ bằng pg-boss cho CMS (tổng hợp số liệu đêm, tự khoá Intern 30 ngày, tạo partition). Dùng khi thêm hoặc sửa tác vụ chạy nền.
---

# Job định kỳ với pg-boss

## Đăng ký
```ts
await boss.schedule('nightly-aggregate', '30 0 * * *', {}, { tz: 'Asia/Ho_Chi_Minh' });
await boss.work('nightly-aggregate', { batchSize: 1 }, ([job]) => this.aggregate.run(job.data));
```
Tên job kebab-case, khai báo tập trung trong `src/modules/<module>/jobs/`.

## Yêu cầu mọi job
- **Idempotent**: chạy lại cùng ngày cho cùng kết quả. Tổng hợp dùng `INSERT ... ON CONFLICT (stat_date, user_id) DO UPDATE`.
- Có tham số ngày (`statDate`) để chạy bù; mặc định là hôm qua theo giờ Việt Nam.
- Xử lý theo lô (vd 500 người/lô), không nạp toàn bộ bảng vào bộ nhớ.
- Log bằng pino: bắt đầu, số bản ghi xử lý, thời gian chạy, lỗi.
- Có unit test cho logic và test tích hợp với Testcontainers.

## Job tự khoá Intern
```sql
UPDATE users u SET status = 'locked', locked_reason = 'inactive_30d', updated_at = now()
FROM user_roles ur JOIN roles r ON r.id = ur.role_id AND r.code = 'INTERN'
WHERE ur.user_id = u.id AND u.status = 'active' AND u.deleted_at IS NULL
  AND COALESCE(u.last_activity_at, u.created_at) < now() - interval '30 days'
RETURNING u.id;
```
Với mỗi id: thu hồi refresh token, ghi `audit_logs` (`actor_id = NULL`, action `user.auto_lock`), tạo `notifications` cho Admin các phòng của Intern. Chỉ áp dụng cho INTERN.

## Thứ tự job đêm 00:30
1. Tổng hợp `daily_user_stats` → 2. `daily_department_stats` → 3. Khoá Intern → 4. Tạo partition `activity_events` tháng sau (nếu chưa có).
