#!/usr/bin/env node
// PreToolUse (Edit|Write|MultiEdit|NotebookEdit): chặn agent sửa file ngoài thư mục được phép.
// Dùng: node guard-paths.mjs <thư-mục-được-phép> [...]
import path from 'node:path';

const allowed = process.argv.slice(2);
let raw = '';
for await (const chunk of process.stdin) raw += chunk;
const input = JSON.parse(raw || '{}');
const file = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
if (!file) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const rel = path.relative(root, path.resolve(root, file)).split(path.sep).join('/');
const ok = !rel.startsWith('..') && allowed.some((p) => {
  if (p.startsWith('*')) return rel.endsWith(p.slice(1));
  return rel === p || rel.startsWith(p.replace(/\/$/, '') + '/');
});
if (ok) process.exit(0);

console.error(`Không được sửa "${rel}". Agent này chỉ được sửa trong: ${allowed.join(', ')}. Nếu cần thay đổi ở đó, báo lại cho BA để giao đúng người.`);
process.exit(2);
