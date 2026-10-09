---
name: plan-sprint
description: Lập kế hoạch sprint và theo dõi tiến độ dự án CMS theo lộ trình 5 giai đoạn. Dùng khi chọn story cho sprint, cập nhật trạng thái, hoặc báo cáo tiến độ.
---

# Lập và theo dõi sprint

## Quy tắc chọn story
1. Theo đúng thứ tự giai đoạn: 1 Nền tảng → 2 Người dùng & phân quyền → 3 Công việc → 4 Phân tích → 5 Hoàn thiện. Chỉ kéo story giai đoạn sau khi mọi phụ thuộc đã `done`.
2. Sprint 1 tuần, mặc định năng lực 20 điểm (sửa trong `docs/decisions.md` nếu khác).
3. Mỗi story phải có task BE, FE, Test. Story chưa có API contract thì chưa được vào sprint.
4. Ưu tiên story mở khoá nhiều story khác (auth, rbac, seed).

## File `docs/sprints/sprint-<n>.md`
```markdown
# Sprint 3 (2026-10-20 → 2026-10-24)
Mục tiêu: Admin giao việc và theo dõi tiến độ trong phòng.
| Story | Điểm | BE | FE | Test | Trạng thái |
|---|---|---|---|---|---|
| TASK-012 | 3 | be-dev | fe-dev | tester | in_progress |
## Rủi ro
## Kết quả cuối sprint
```
Trạng thái story: `todo`, `in_progress`, `review`, `testing`, `done`, `blocked` (ghi lý do).

## Báo cáo tiến độ
Ngắn gọn: % điểm hoàn thành, story bị chặn và lý do, lỗi critical đang mở, việc cần quyết định.

## Định nghĩa "done" của story
Code merge, test tự động qua, tester xác nhận đủ ca phân quyền, không còn lỗi critical/major mở.
