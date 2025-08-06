import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler(),
    );

    if (!requiredPermissions) {
      return true;
    }

    const [service, permission] = requiredPermissions;
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.permissions) {
      return false;
    }

    const servicePermissions = user.permissions[service];
    if (!servicePermissions) {
      return false;
    }

    return servicePermissions.includes(permission);
  }
} 