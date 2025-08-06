import { SetMetadata } from '@nestjs/common';
 
export const Permissions = (service: string, permission: string) =>
  SetMetadata('permissions', [service, permission]); 