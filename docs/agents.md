# Subagent cho dự án CMS

Năm agent Claude Code tương ứng các vị trí trong dự án:

| File | Vai trò | Được sửa |
|---|---|---|
| `.claude/agents/ba-pm.md` | BA kiêm Project Manager | `docs/` |
| `.claude/agents/be-dev.md` | Backend (NestJS + Prisma) | `apps/api`, `packages/shared-types` |
| `.claude/agents/fe-dev.md` | Frontend (React 19 + shadcn/ui) | `apps/web`, `packages/shared-types` |
| `.claude/agents/tester.md` | Tester / QA | file test, `docs/test-cases`, `docs/bugs` |
| `.claude/agents/reviewer.md` | Reviewer kỹ thuật | không sửa gì (chỉ đọc) |

## Rule và skill
- `CLAUDE.md`: rule chung cho mọi agent (thuật ngữ, rule bất biến, lệnh, git).
- `.claude/skills/`: skill theo vai trò, được gắn vào agent qua trường `skills:`.

| Agent | Skill |
|---|---|
| ba-pm | write-user-story, plan-sprint, delegate-work |
| be-dev | nestjs-module, rbac-scope, prisma-migration, pgboss-job, dynamic-task-fields |
| fe-dev | web-feature, permission-ui, dynamic-task-fields |
| tester | permission-matrix-test, e2e-playwright, bug-report |
| reviewer | code-review-checklist, rbac-scope, prisma-migration |

## Hook và quyền (chặn cứng, không phụ thuộc prompt)
- `guard-paths.mjs` (gắn trong frontmatter từng agent): mỗi agent chỉ sửa được thư mục của mình như bảng trên. Reviewer không có công cụ sửa file.
- `protect-migrations.mjs`: không ai sửa được migration Prisma đã tồn tại.
- `lint-changed.mjs`: chạy ESLint `--fix` sau mỗi lần sửa file TS/TSX, lỗi còn lại trả về cho agent tự sửa.
- `settings.json` chặn đọc `.env`, `git push --force`, `prisma migrate reset`.
Hook dùng Node (đã có sẵn vì dự án dùng Node 22), không cần cài thêm.

## Cách dùng
1. `.claude/` và `CLAUDE.md` đã nằm ở gốc repo.
2. Kế hoạch kiến trúc ở `docs/ke-hoach-kien-truc.md` (các agent đọc kế hoạch ở đường dẫn này).
3. Mở Claude Code trong repo. `.claude/settings.json` đặt `"agent": "ba-pm"`, nên phiên chính chính là BA (hoặc chạy `claude --agent ba-pm`).
4. Giao mọi việc cho BA bằng ngôn ngữ thường, ví dụ "làm giai đoạn 1". BA viết story rồi tự gọi be-dev, fe-dev, tester qua công cụ Agent.

Lưu ý: trong Claude Code, subagent không gọi được subagent khác. Vì vậy BA phải chạy ở phiên chính (cấu hình trên) thì mới giao việc xuống được; nếu gọi BA như một subagent thì BA chỉ viết được tài liệu.

## Quy trình gợi ý cho mỗi tính năng
Người dùng → ba-pm viết story + API contract → ba-pm giao be-dev và fe-dev (song song khi contract đã rõ) → ba-pm giao reviewer → ba-pm giao tester → lỗi quay lại dev (tối đa 3 vòng) → ba-pm nghiệm thu, báo người dùng.
