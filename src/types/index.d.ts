import { Request } from 'express';
import { User, Tenant } from '../models';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      tenant?: Tenant;
      token?: string;
    }
  }
}

export interface TenantConfig {
  features: Record<string, boolean>;
  securityPolicy: {
    passwordPolicy?: {
      minLength: number;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
    };
    sessionTimeout?: number;
    allowedIPs?: string[];
  };
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  tenants: {
    id: string;
    name: string;
    roles: string[];
  }[];
}
