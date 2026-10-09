---
name: write-user-story
description: Viết user story CMS kèm tiêu chí nghiệm thu Given/When/Then, ca phân quyền cho 4 vai trò và API contract. Dùng khi phân tích yêu cầu mới hoặc chia một tính năng thành story.
---

# Viết user story

## Bước
1. Đọc mục liên quan trong `docs/ke-hoach-kien-truc.md` và `docs/decisions.md`.
2. Xác định module, giai đoạn (1-5), quyền cần và phạm vi.
3. Đặt mã story `<MODULE>-<số>` (vd `TASK-012`), lưu tại `docs/stories/<module>/<MA>.md`, thêm một dòng vào `docs/backlog.md`.
4. Điền đủ mẫu dưới. Không bỏ trống mục nào; chỗ chưa rõ ghi `Giả định:`.
5. Tự kiểm bằng checklist cuối file.

## Mẫu
```markdown
# TASK-012 Giao việc cho thành viên phòng
Giai đoạn: 3   Module: tasks   Ưu tiên: high   Ước lượng: 3 điểm
Là Admin phòng, tôi muốn giao việc cho thành viên trong phòng để theo dõi ai làm gì.

## Tiêu chí nghiệm thu
- Given Admin của phòng Audio, When giao việc thuộc Audio cho thành viên Audio, Then việc có người nhận, người nhận nhận thông báo.
- Given ..., When ..., Then ...

## Ca phân quyền
| Vai trò | Kết quả |
|---|---|
| Super Admin | Được ở mọi phòng |
| Admin (phòng được gán) | Được |
| Admin (phòng không được gán) | 403 |
| User | 403 |
| Intern | 403 |
| Chưa đăng nhập | 401 |

## API contract
POST /api/v1/tasks/:id/assignees
Request: { "userIds": ["uuid"] }
Response 200: { "data": TaskDto }
Lỗi: 400 VALIDATION_ERROR, 403 FORBIDDEN_SCOPE, 404 TASK_NOT_FOUND, 422 ASSIGNEE_NOT_IN_DEPARTMENT

## Ghi nhận dữ liệu
activity_events: task_assigned   audit_logs: không   notifications: task_assigned

## Màn hình
Chi tiết việc → ô "Người nhận" (chỉ hiện khi có quyền task.assign)

## Phụ thuộc
TASK-001

## Task con
- BE: ...  - FE: ...  - Test: ...
```

## Checklist
- [ ] Có đủ 6 dòng ca phân quyền
- [ ] Mã lỗi viết HOA_GẠCH_DƯỚI, khớp mã HTTP
- [ ] Ghi rõ có ghi activity_events / audit_logs / notifications không
- [ ] Không mâu thuẫn quyết định đã chốt
