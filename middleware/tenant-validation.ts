import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/error.types';

export const validateTenantAccess = async (
  req: Request,
  res: Response, 
  next: NextFunction
): Promise<void> => {
  const tenantId = req.headers['x-tenant-id'];
  const user = req.user;

  try {
    // Verify tenant exists
    const tenant = await Tenant.findByPk(tenantId as string);
    if (!tenant) {
      throw new AppError('TENANT_NOT_FOUND', 'Tenant not found');
    }

    // Verify tenant is active
    if (tenant.status !== 'active') {
      throw new AppError('TENANT_INACTIVE', 'Tenant is not active');
    }

    // Verify user has access to tenant
    const hasAccess = await TenantUserMapping.findOne({
      where: {
        userId: user.id,
        tenantId: tenantId,
        status: 'active'
      }
    });

    if (!hasAccess) {
      throw new AppError('UNAUTHORIZED', 'User does not have access to tenant');
    }

    next();
  } catch (error) {
    next(error);
  }
};
