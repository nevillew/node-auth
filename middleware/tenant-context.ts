import { createNamespace } from 'cls-hooked';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/error.types';

export class TenantContext {
  private static namespaceKey = 'tenant-context';
  private static namespace = createNamespace(TenantContext.namespaceKey);

  static runWithTenant(tenantId: string, next: () => void) {
    this.namespace.run(() => {
      this.setCurrentTenant(tenantId);
      next();
    });
  }

  static getCurrentTenant(): string | undefined {
    return this.namespace.get('tenantId');
  }

  private static setCurrentTenant(tenantId: string): void {
    this.namespace.set('tenantId', tenantId);
    this.namespace.set('authToken', null);
  }

  static setAuthToken(token: string): void {
    this.namespace.set('authToken', token);
  }

  static getAuthToken(): string | undefined {
    return this.namespace.get('authToken');
  }

  static clear(): void {
    this.namespace.set('tenantId', undefined);
    this.namespace.set('authToken', undefined);
  }
}

export const tenantContextMiddleware = (
  req: Request, 
  res: Response, 
  next: NextFunction
): void => {
  const tenantId = req.headers['x-tenant-id'] || TenantContext.getCurrentTenant();
  
  if (!tenantId) {
    throw new AppError('TENANT_REQUIRED', 'Tenant ID is required');
  }

  TenantContext.runWithTenant(tenantId as string, next);
};
