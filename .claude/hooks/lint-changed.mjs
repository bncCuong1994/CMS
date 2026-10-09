#!/usr/bin/env node
// PostToolUse (Edit|Write|MultiEdit): chạy ESLint (--fix) cho file TS/TSX vừa sửa, báo lỗi còn lại cho agent.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
const input = JSON.parse(raw || '{}');
const file = input.tool_input?.file_path;
if (!file || !/\.(ts|tsx)$/.test(file)) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const rel = path.relative(root, path.resolve(root, file)).split(path.sep).join('/');
const app = rel.match(/^(apps\/[^/]+|packages\/[^/]+)\//)?.[1];
if (!app) process.exit(0);

const eslint = path.join(root, app, 'node_modules', '.bin', 'eslint');
if (!fs.existsSync(eslint)) process.exit(0); // chưa cài dependency: bỏ qua

try {
  execFileSync(eslint, ['--fix', path.relative(app, rel)], {
    cwd: path.join(root, app), stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000,
  });
} catch (e) {
  if (e.signal) process.exit(0); // quá thời gian: bỏ qua
  const out = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim();
  if (!out) process.exit(0);
  console.error(`ESLint còn lỗi ở ${rel}, hãy sửa:\n${out.slice(0, 4000)}`);
  process.exit(2);
}
