---
name: bug-report
description: Ghi báo lỗi CMS có bước tái hiện, mức độ và bằng chứng vào docs/bugs. Dùng khi test phát hiện hành vi lệch story hoặc kế hoạch.
---

# Báo lỗi

## Mức độ
- **critical**: lộ hoặc sửa được dữ liệu ngoài phạm vi quyền, mất dữ liệu, không đăng nhập được, job làm sai dữ liệu hàng loạt.
- **major**: tính năng chính không dùng được hoặc số liệu báo cáo sai.
- **minor**: sai hiển thị, văn bản, trải nghiệm.

## File `docs/bugs/BUG-<số>.md`
```markdown
# BUG-007 Admin Audio xem được việc của phòng Video qua API
Mức độ: critical   Module: tasks   Story: TASK-003   Trạng thái: open
Commit: <sha>   Môi trường: docker compose local

## Bước tái hiện
1. Đăng nhập adminAudio
2. GET /api/v1/tasks/<id việc phòng Video>

## Thực tế
200, trả đủ dữ liệu việc

## Mong đợi
403 FORBIDDEN_SCOPE (story TASK-003, mục Ca phân quyền)

## Bằng chứng
<response, log, ảnh, trace>

## Test tái hiện
apps/api/test/tasks.e2e-spec.ts › "adminAudio đọc việc phòng Video → 403" (đang fail)
```
Mỗi lỗi kèm một test tự động đang fail tái hiện được nó. Trạng thái: `open`, `fixing`, `fixed`, `verified`, `wontfix` (ghi lý do). Chỉ tester chuyển sang `verified` sau khi chạy lại test.
