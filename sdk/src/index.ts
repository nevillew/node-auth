import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { 
  AuthResponse,
  LoginParams,
  UserResponse,
  TenantResponse,
  NotificationResponse,
  CreateTenantParams,
  UpdateTenantParams,
  CreateUserParams,
  UpdateUserParams,
  SearchUsersParams,
  BulkUpdateUsersParams
} from './types';

export class MultiTenantSDK {
  private client: AxiosInstance;
  private token?: string;
  private tenantId?: string;

  constructor(config: { 
    baseURL: string;
    token?: string;
    tenantId?: string;
  }) {
    this.token = config.token;
    this.tenantId = config.tenantId;

    this.client = axios.create({
      baseURL: config.baseURL,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor for auth and tenant headers
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      if (this.tenantId) {
        config.headers['X-Tenant-ID'] = this.tenantId;
      }
      return config;
    });
  }

  // Auth methods
  async login(params: LoginParams): Promise<AuthResponse> {
    const response = await this.client.post('/auth/login', params);
    this.token = response.data.token;
    return response.data;
  }

  async loginWithGoogle(): Promise<void> {
    window.location.href = `${this.client.defaults.baseURL}/auth/google`;
  }

  async loginWithPasskey(email: string): Promise<any> {
    const options = await this.client.post('/auth/passkey/login/options', { email });
    return options.data;
  }

  async logout(): Promise<void> {
    this.token = undefined;
  }

  // User methods
  async getUser(id: string): Promise<UserResponse> {
    const response = await this.client.get(`/users/${id}`);
    return response.data;
  }

  async createUser(params: CreateUserParams): Promise<UserResponse> {
    const response = await this.client.post('/users', params);
    return response.data;
  }

  async updateUser(id: string, params: UpdateUserParams): Promise<UserResponse> {
    const response = await this.client.put(`/users/${id}`, params);
    return response.data;
  }

  async searchUsers(params: SearchUsersParams): Promise<{
    users: UserResponse[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const response = await this.client.get('/users/search', { params });
    return response.data;
  }

  async bulkUpdateUsers(params: BulkUpdateUsersParams): Promise<{
    updated: number;
  }> {
    const response = await this.client.post('/users/bulk/update', params);
    return response.data;
  }

  // Tenant methods
  async createTenant(params: CreateTenantParams): Promise<TenantResponse> {
    const response = await this.client.post('/tenants', params);
    return response.data;
  }

  async getTenant(id: string): Promise<TenantResponse> {
    const response = await this.client.get(`/tenants/${id}`);
    return response.data;
  }

  async updateTenant(id: string, params: UpdateTenantParams): Promise<TenantResponse> {
    const response = await this.client.put(`/tenants/${id}`, params);
    return response.data;
  }

  async suspendTenant(id: string): Promise<TenantResponse> {
    const response = await this.client.post(`/tenants/${id}/suspend`);
    return response.data;
  }

  // Notification methods
  async getNotifications(): Promise<NotificationResponse[]> {
    const response = await this.client.get('/notifications');
    return response.data;
  }

  async markNotificationAsRead(id: string): Promise<NotificationResponse> {
    const response = await this.client.put(`/notifications/${id}/read`);
    return response.data;
  }

  // Utility methods
  setToken(token: string): void {
    this.token = token;
  }

  setTenantId(tenantId: string): void {
    this.tenantId = tenantId;
  }
}

export * from './types';
