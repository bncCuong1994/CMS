import { PrismaClient } from '@prisma/client';
import { ALL_PERMISSIONS, DEFAULT_ROLES, PERMISSION_DESCRIPTIONS } from '@cms/shared-types';

/**
 * Tạo quyền và 4 vai trò mặc định. Chạy lại nhiều lần an toàn: chỉ thêm phần còn thiếu,
 * không xoá quyền Super Admin đã chỉnh thêm cho vai trò.
 */
export async function seedRolesAndPermissions(prisma: PrismaClient) {
  for (const code of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: { description: PERMISSION_DESCRIPTIONS[code] },
      create: { code, description: PERMISSION_DESCRIPTIONS[code] },
    });
  }
  const permissionIds = new Map((await prisma.permission.findMany()).map((p) => [p.code, p.id] as const));

  for (const def of DEFAULT_ROLES) {
    const role = await prisma.role.upsert({
      where: { code: def.code },
      update: { name: def.name, description: def.description, isSystem: true },
      create: { code: def.code, name: def.name, description: def.description, isSystem: true },
    });
    await prisma.rolePermission.createMany({
      data: def.permissions.map((code) => ({ roleId: role.id, permissionId: permissionIds.get(code)! })),
      skipDuplicates: true,
    });
  }
}
