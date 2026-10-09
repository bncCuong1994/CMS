#!/usr/bin/env node
// PreToolUse (Edit|Write|MultiEdit): không cho sửa migration Prisma đã tồn tại. Tạo migration mới vẫn được.
import fs from 'node:fs';
import path from 'node:path';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
const input = JSON.parse(raw || '{}');
const file = input.tool_input?.file_path;
if (!file) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const abs = path.resolve(root, file);
const rel = path.relative(root, abs).split(path.sep).join('/');
if (!rel.startsWith('apps/api/prisma/migrations/') || !fs.existsSync(abs)) process.exit(0);
if (rel.endsWith('migration_lock.toml')) process.exit(0);

console.error(`Không được sửa migration đã có: ${rel}. Hãy tạo migration mới bằng "prisma migrate dev --create-only --name <ten>".`);
process.exit(2);
