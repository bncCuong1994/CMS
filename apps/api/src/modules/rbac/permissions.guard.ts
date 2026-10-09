import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasPermission } from '@cms/shared-types';
import { AuthUser, IS_PUBLIC_KEY, PERMISSION_KEY, PermissionRequirement } from '../../common/decorators';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const req = this.reflector.getAllAndOverride<PermissionRequirement | undefined>(PERMISSION_KEY, targets);
    if (!req) return true;

    const request = ctx.switchToHttp().getRequest();
    const user: AuthUser | undefined = request.user;
    if (!user) throw new ForbiddenException();

    if (req.globalOnly) {
      if (!user.grants.global.includes(req.permission)) throw new ForbiddenException('Cần quyền toàn hệ thống');
      return true;
    }

    const departmentId = req.departmentFrom
      ? (request[req.departmentFrom.source]?.[req.departmentFrom.key] as string | undefined)
      : undefined;

    if (req.departmentFrom && !departmentId && !user.grants.global.includes(req.permission)) {
      throw new ForbiddenException('Thiếu phòng ban');
    }
    if (!hasPermission(user.grants, req.permission, departmentId)) {
      throw new ForbiddenException('Không có quyền thực hiện thao tác này');
    }
    return true;
  }
}
