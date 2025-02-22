import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/error.types';

export const crossTenantAccessControl = (
  allowedRoles: string[] = []
) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const sourceTenantId = req.headers['x-tenant-id'];
    const targetTenantId = req.params.tenantId || req.body.tenantId;

    // Skip if same tenant
    if (sourceTenantId === targetTenantId) {
      return next();
    }

    try {
      // Check if user has cross-tenant access
      const hasAccess = await CrossTenantPermissionService.validateAccess({
        userId: req.user.id,
        sourceTenantId: sourceTenantId as string,
        targetTenantId: targetTenantId as string,
        roles: allowedRoles
      });

      if (!hasAccess) {
        throw new AppError('UNAUTHORIZED', 'Cross-tenant access denied');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
