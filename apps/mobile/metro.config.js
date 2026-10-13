// Cấu hình Metro cho monorepo pnpm.
// Điểm dễ vỡ nhất của Expo trong pnpm: symlink + resolve package workspace.
// SDK 54 (expo/metro-config) đã tự bật resolver symlink; ở đây chỉ cần:
//   (1) watch thêm gốc workspace (GIỮ các watchFolders mặc định của Expo),
//   (2) tìm node_modules ở cả app lẫn gốc workspace.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Giữ mặc định của Expo rồi bổ sung gốc workspace (để thấy packages/shared-types).
config.watchFolders = [...(config.watchFolders ?? []), workspaceRoot];

// 2. Phân giải module từ node_modules của app rồi tới gốc workspace (pnpm hoist ở gốc).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
