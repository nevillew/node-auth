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
  isImpersonated?: boolean;
  impersonator?: {
    id: string;
    email: string;
    name: string;
  };
