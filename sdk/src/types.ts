export interface LoginParams {
  email: string;
  password: string;
  token?: string; // For 2FA
}

export interface AuthResponse {
  token: string;
  user: UserResponse;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  status: 'active' | 'inactive' | 'suspended';
  preferences: UserPreferences;
  lastActivity?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  accessibility: {
    highContrast: boolean;
    fontSize: 'small' | 'normal' | 'large';
  };
  privacy: {
    profileVisibility: 'public' | 'private';
    activityVisibility: 'public' | 'private';
  };
}

export interface TenantResponse {
  id: string;
  name: string;
  slug: string;
  features: Record<string, boolean>;
  status: 'active' | 'suspended';
  securityPolicy: TenantSecurityPolicy;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSecurityPolicy {
  password: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    preventPasswordReuse: number;
    expiryDays: number;
  };
  session: {
    maxConcurrentSessions: number;
    sessionTimeout: number;
    extendOnActivity: boolean;
    requireMFA: boolean;
  };
  ipRestrictions: {
    enabled: boolean;
    allowedIPs: string[];
    allowedRanges: string[];
    blockList: string[];
  };
}

export interface NotificationResponse {
  id: string;
  userId: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface CreateTenantParams {
  name: string;
  slug?: string;
  features?: Record<string, boolean>;
  securityPolicy?: Partial<TenantSecurityPolicy>;
}

export interface UpdateTenantParams {
  name?: string;
  features?: Record<string, boolean>;
  securityPolicy?: Partial<TenantSecurityPolicy>;
  status?: 'active' | 'suspended';
}

export interface CreateUserParams {
  email: string;
  password: string;
  name: string;
  avatar?: string;
}

export interface UpdateUserParams {
  name?: string;
  avatar?: string;
  preferences?: Partial<UserPreferences>;
}

export interface SearchUsersParams {
  query?: string;
  status?: 'active' | 'inactive' | 'suspended';
  role?: string;
  tenant?: string;
  lastLoginStart?: string;
  lastLoginEnd?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface BulkUpdateUsersParams {
  userIds: string[];
  updates: {
    status?: 'active' | 'inactive' | 'suspended';
    roleIds?: string[];
    permissionIds?: string[];
  };
}
