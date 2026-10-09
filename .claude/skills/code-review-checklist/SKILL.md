---
name: code-review-checklist
description: Danh sách kiểm tra khi review code CMS (phân quyền, bảo mật, dữ liệu, chuẩn NestJS/React, test). Dùng khi review diff của be-dev hoặc fe-dev.
---

# Checklist review

Đi lần lượt, mỗi mục vi phạm ghi `file:dòng`.

## 1. Phân quyền và bảo mật (lỗi ở đây luôn là critical)
- [ ] Mọi route mới có `@RequirePermission` đúng mã quyền trong story
- [ ] Service kiểm phạm vi phòng ban (`assertDepartment`/`departmentFilter`) trước khi đọc/ghi; danh sách lọc ở câu truy vấn, không lọc sau
- [ ] Intern chỉ chạm được việc được giao; báo cáo đúng phạm vi theo vai trò
- [ ] Không tin `departmentId`/`userId` từ client khi có thể lấy từ token hoặc từ bản ghi trong DB
- [ ] Không trả `password_hash`, token, dữ liệu phòng khác trong response; DTO response liệt kê field rõ ràng
- [ ] Không có SQL nối chuỗi; `$queryRaw` dùng tham số
- [ ] Đổi vai trò/khoá tài khoản có thu hồi refresh token
- [ ] Không có secret, URL nội bộ, `console.log` dữ liệu nhạy cảm

## 2. Dữ liệu
- [ ] Truy vấn lọc `deletedAt: null`
- [ ] Ghi nhiều bảng trong `$transaction`; `activity_events` cùng transaction với thao tác
- [ ] Thao tác quản trị ghi `audit_logs` có `before`/`after`
- [ ] Migration mới không sửa migration cũ; có chỉ mục cho cột lọc/sắp xếp mới; thay đổi phá vỡ được tách 2 bước
- [ ] Không có truy vấn N+1 trong vòng lặp; danh sách có phân trang, `pageSize` có giới hạn

## 3. Kiến trúc
- [ ] Module không truy vấn bảng của module khác
- [ ] Controller mỏng, logic ở service
- [ ] Kiểu dùng chung đặt ở `packages/shared-types`, FE không khai báo lại
- [ ] Không đổi quyết định đã chốt trong kế hoạch

## 4. Frontend
- [ ] Dữ liệu server qua TanStack Query, không fetch trong `useEffect`; invalidate đúng query key
- [ ] Nút/menu/route bọc `<Can>`/`RequirePermission`; vẫn xử lý được 403 từ API
- [ ] Có trạng thái loading/rỗng/lỗi; form hiển thị lỗi validate
- [ ] Không hard-code màu; dùng component shadcn có sẵn trước khi tự viết

## 5. Test
- [ ] Có test cho logic mới; e2e có ca 401, 403 (Admin phòng khác), 404, 400
- [ ] Không có test bị `skip`/`only`, không xoá hay nới lỏng assertion cũ để cho qua
- [ ] Lint, test, build đã chạy và qua (tự chạy lại để xác nhận)

## Mức độ
critical: bảo mật, phân quyền, mất/sai dữ liệu. major: sai nghiệp vụ, thiếu test bắt buộc, vi phạm kiến trúc. minor: còn lại, ghi ở phần góp ý.
