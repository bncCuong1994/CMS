---
name: permission-matrix-test
description: Sinh và chạy bộ test ma trận phân quyền cho endpoint CMS với 4 vai trò và các ca phạm vi phòng ban. Dùng khi kiểm thử bất kỳ endpoint hay tính năng có phân quyền.
---

# Test ma trận phân quyền

## Fixture chuẩn (`apps/api/test/fixtures/actors.ts`)
| Khoá | Mô tả |
|---|---|
| `superAdmin` | SUPER_ADMIN global |
| `adminAudio` | ADMIN chỉ phòng Audio |
| `adminAudioVideo` | ADMIN ở Audio và Video Editor |
| `userMarketing` | USER phòng Marketing |
| `internVideo` | INTERN phòng Video Editor, được giao 1 việc |
| `anonymous` | không token |
Hàm `tokenFor(actor)` đăng nhập thật qua `/auth/login`, không tự ký JWT.

## Mẫu test bảng
```ts
const cases: [ActorKey, string /*departmentCode*/, number][] = [
  ['superAdmin', 'AUDIO', 201],
  ['adminAudio', 'AUDIO', 201],
  ['adminAudio', 'VIDEO', 403],
  ['adminAudioVideo', 'VIDEO', 201],
  ['userMarketing', 'AUDIO', 403],
  ['internVideo', 'VIDEO', 403],
  ['anonymous', 'AUDIO', 401],
];
it.each(cases)('%s tạo việc ở %s → %i', async (actor, dept, status) => {
  await request(app).post('/api/v1/tasks').auth(await tokenFor(actor), { type: 'bearer' })
    .send(validTask(dept)).expect(status);
});
```

## Ca luôn phải có
- Admin thao tác ở phòng không được gán → 403 `FORBIDDEN_SCOPE`.
- Danh sách: Admin Audio không thấy bản ghi phòng Video (kiểm nội dung, không chỉ mã HTTP).
- Truy cập trực tiếp id của phòng khác → 403 (hoặc 404 nếu thiết kế ẩn tồn tại, theo story).
- Intern xem/cập nhật việc không được giao → 403.
- Tài khoản `locked` → đăng nhập 401/403, refresh token bị từ chối.
- Sau khi đổi vai trò, refresh token cũ bị từ chối.
- Báo cáo: User chỉ thấy số của mình; Intern 403.

## Đầu ra
Cập nhật bảng ma trận trong `docs/test-cases/<module>.md` với cột kết quả thực tế. Mọi ô lệch kỳ vọng tạo bug mức **critical** (skill bug-report).
