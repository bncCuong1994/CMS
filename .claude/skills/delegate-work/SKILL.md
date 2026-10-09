---
name: delegate-work
description: Quy trình BA/PM nhận yêu cầu từ người dùng, phân tích thành story rồi giao việc cho be-dev, fe-dev, tester bằng công cụ Agent và nghiệm thu kết quả. Dùng mỗi khi người dùng giao một yêu cầu mới.
---

# Nhận yêu cầu và giao việc

## Luồng chuẩn cho mỗi yêu cầu
1. **Hiểu yêu cầu**: đọc kế hoạch, backlog, decisions. Nếu yêu cầu đổi quyết định đã chốt hoặc mơ hồ ở chỗ ảnh hưởng nghiệp vụ, hỏi người dùng một câu ngắn có phương án đề xuất. Còn lại tự chọn phương án hợp lý và ghi `Giả định:`.
2. **Viết story** theo skill `write-user-story` (có API contract). Báo người dùng danh sách story sẽ làm trước khi giao nếu yêu cầu lớn hơn 1 story.
3. **Giao BE trước hoặc song song FE** khi API contract đã rõ. Việc chỉ có BE hoặc chỉ có FE thì chỉ giao một bên.
4. **Giao reviewer** sau khi dev báo xong, kèm story và nhánh/base để lấy diff. REQUEST_CHANGES → giao lại dev kèm danh sách lỗi chặn → review lại.
5. **Giao tester** khi reviewer APPROVE: viết test case từ story, chạy test, kiểm ma trận phân quyền.
6. **Xử lý lỗi**: reviewer hoặc tester báo lỗi → giao lại cho dev kèm lỗi → bên đã báo kiểm lại. Tối đa 3 vòng mỗi story; quá 3 vòng thì báo người dùng.
7. **Nghiệm thu**: CI trên GitHub phải xanh; tự kiểm `git diff --stat`, chạy lại lint/test/build; đối chiếu tiêu chí nghiệm thu; cập nhật trạng thái story và sprint.
8. **Báo người dùng** ngắn gọn: đã xong gì, story nào, kết quả test (số pass/fail), giả định đã chọn, việc cần người dùng quyết.

## Mẫu prompt khi giao (công cụ Agent)
Subagent không thấy cuộc trò chuyện của bạn, nên prompt phải tự đủ:
```
Story: docs/stories/tasks/TASK-012.md (đọc file này trước)
Việc của bạn: <BE | FE | Test> cho story trên.
Phạm vi: <file/module được sửa>. Không sửa ngoài phạm vi.
API contract: theo mục "API contract" trong story.
Ràng buộc thêm: <nếu có>
Khi xong, trả về: file đã sửa, lệnh đã chạy và kết quả, điều bên kia (FE/BE/Tester) cần biết, chỗ còn vướng.
```

## Nhánh và chạy song song
- Mỗi story một nhánh `feat/<MA-story>-<mo-ta>`; tạo nhánh trước khi giao dev.
- be-dev và fe-dev chạy song song khi contract đã chốt: gọi Agent với `isolation: "worktree"` cho từng dev để mỗi bên có bản làm việc riêng, không ghi đè nhau. `packages/shared-types` do BE sửa trước, FE chỉ đọc.
- Khi cả hai xong: merge nhánh worktree vào nhánh story (`git merge`). Có conflict thì không tự sửa code; giao lại dev phụ trách phần đó xử lý.
- Không giao hai dev sửa cùng một module cùng lúc.

## Không làm
- Không tự sửa code thay dev, kể cả sửa nhỏ.
- Không đánh dấu story `done` khi tester chưa xác nhận.
- Không chuyển yêu cầu nguyên văn cho dev mà không có story.
