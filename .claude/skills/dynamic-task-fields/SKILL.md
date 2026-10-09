---
name: dynamic-task-fields
description: Định nghĩa và render trường tuỳ biến theo loại công việc của từng phòng (task_types.custom_fields / tasks.custom_values) ở cả FE và BE. Dùng khi làm màn hình loại công việc hoặc form việc.
---

# Trường tuỳ biến theo loại công việc

## Định dạng `custom_fields` (dùng chung, khai báo trong `@cms/shared-types`)
```ts
type CustomField =
  | { key: string; label: string; type: 'text' | 'textarea'; required: boolean; maxLength?: number }
  | { key: string; label: string; type: 'number'; required: boolean; min?: number; max?: number; unit?: string }
  | { key: string; label: string; type: 'date' | 'boolean'; required: boolean }
  | { key: string; label: string; type: 'select'; required: boolean; options: string[] };
```
`key` dạng snake_case, duy nhất trong một loại. Ví dụ phòng Video: `video_length` (number, unit "phút"), `export_format` (select: mp4, mov). Phòng Audio: `track_count` (number).

## Backend
- Sinh validator từ `custom_fields` (zod hoặc hàm tự viết trong `src/modules/tasks/custom-fields.validator.ts`), chạy khi tạo/sửa việc; lỗi trả 422 `INVALID_CUSTOM_VALUES` kèm `field`.
- `task_type` phải thuộc cùng phòng với việc, ngược lại 422 `TASK_TYPE_DEPARTMENT_MISMATCH`.
- Loại việc `is_active = false` không chọn được cho việc mới nhưng việc cũ vẫn hiển thị.
- Đổi `custom_fields` không xoá dữ liệu cũ trong `custom_values`; key bị bỏ chỉ ẩn đi.

## Frontend
- Hàm `buildCustomFieldsSchema(fields): ZodObject` ghép vào schema form việc.
- Component `<CustomFieldsRenderer fields={...} />` map `type` → component shadcn (Input, Textarea, Select, Checkbox, DatePicker).
- Màn hình quản lý loại công việc: danh sách trường kéo thả sắp xếp, xem trước form.

## Test
Mỗi `type` có test hợp lệ và không hợp lệ ở cả FE và BE; test việc phòng A dùng loại việc phòng B bị từ chối.
