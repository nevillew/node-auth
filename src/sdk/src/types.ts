export interface UserPreferences {
  theme: string;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  accessibility: {
    highContrast: boolean;
    fontSize: string;
  };
  privacy: {
    profileVisibility: string;
    activityVisibility: string;
  };
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
  isImpersonated?: boolean;
  impersonator?: {
    id: string;
    email: string;
    name: string;
  };
}
