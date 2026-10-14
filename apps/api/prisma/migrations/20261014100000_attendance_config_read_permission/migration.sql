-- US-ATT-03 (phân quyền 2026-10-14): tách ĐỌC khỏi GHI cấu hình chấm công.
-- Thêm quyền `attendance.config_read` (xem cấu hình) và gán cho ADMIN + USER,
-- để DB đã migrate khớp với seed (seedRolesAndPermissions). Idempotent.
-- Quyền GHI `attendance.config` giữ nguyên chỉ cho Super Admin (qua ALL_PERMISSIONS, không đụng ở đây).

-- 1) Chèn quyền đọc nếu chưa có (id sinh bằng gen_random_uuid sẵn có trên PostgreSQL 17).
INSERT INTO "permissions" ("id", "code", "description")
VALUES (gen_random_uuid(), 'attendance.config_read', 'Xem cấu hình chấm công')
ON CONFLICT ("code") DO UPDATE SET "description" = EXCLUDED."description";

-- 2) Gán quyền đọc cho ADMIN và USER.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" IN ('ADMIN', 'USER')
  AND p."code" = 'attendance.config_read'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
