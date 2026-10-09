---
name: e2e-playwright
description: Viết và chạy test E2E Playwright cho các luồng chính của CMS theo từng vai trò. Dùng khi kiểm thử luồng người dùng xuyên FE và BE.
---

# E2E với Playwright

## Thiết lập
- Test ở `apps/web/e2e/`. Trước khi chạy: DB sạch + `seed-demo.ts`; chạy bằng `pnpm --filter web e2e`.
- Đăng nhập một lần cho mỗi vai trò bằng `storageState` (`e2e/.auth/<role>.json`) trong project `setup`.
- Chọn phần tử bằng `getByRole`/`getByLabel` với nhãn tiếng Việt; chỉ dùng `data-testid` khi không có cách khác. Không dùng `waitForTimeout`.

## Luồng tối thiểu
1. Đăng nhập/đăng xuất, sai mật khẩu, tài khoản bị khoá.
2. Super Admin tạo phòng, tạo Admin, gán Admin vào 2 phòng.
3. Admin tạo loại công việc có trường tuỳ biến, tạo việc, giao cho Intern.
4. Intern thấy việc, kéo trên kanban sang `in_progress`, cập nhật %, bình luận; không thấy menu Báo cáo.
5. Admin xem báo cáo phòng, xuất Excel (kiểm file tải về có dữ liệu).
6. Admin chuyển Intern → User; lịch sử việc còn nguyên.
7. Mỗi vai trò: menu hiển thị đúng; mở URL trang không có quyền thấy trang 403.

## Khi fail
Đính kèm trace (`--trace on-first-retry`), ảnh chụp và video vào báo lỗi. Test chập chờn: tìm nguyên nhân, không thêm retry để che.
