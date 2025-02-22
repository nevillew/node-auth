// src/index.ts
import axios from "axios";
var MultiTenantSDK = class {
  client;
  token;
  tenantId;
  constructor(config) {
    this.token = config.token;
    this.tenantId = config.tenantId;
    this.client = axios.create({
      baseURL: config.baseURL,
      headers: {
        "Content-Type": "application/json"
      }
    });
    this.client.interceptors.request.use((config2) => {
      if (this.token) {
        config2.headers.Authorization = `Bearer ${this.token}`;
      }
      if (this.tenantId) {
        config2.headers["X-Tenant-ID"] = this.tenantId;
      }
      return config2;
    });
  }
  // Auth methods
  async login(params) {
    const response = await this.client.post("/auth/login", params);
    this.token = response.data.token;
    return response.data;
  }
  async loginWithGoogle() {
    window.location.href = `${this.client.defaults.baseURL}/auth/google`;
  }
  async loginWithPasskey(email) {
    const options = await this.client.post("/auth/passkey/login/options", { email });
    return options.data;
  }
  async logout() {
    this.token = void 0;
  }
  // User methods
  async getUser(id) {
    const response = await this.client.get(`/users/${id}`);
    return response.data;
  }
  async createUser(params) {
    const response = await this.client.post("/users", params);
    return response.data;
  }
  async updateUser(id, params) {
    const response = await this.client.put(`/users/${id}`, params);
    return response.data;
  }
  async searchUsers(params) {
    const response = await this.client.get("/users/search", { params });
    return response.data;
  }
  async bulkUpdateUsers(params) {
    const response = await this.client.post("/users/bulk/update", params);
    return response.data;
  }
  // Tenant methods
  async createTenant(params) {
    const response = await this.client.post("/tenants", params);
    return response.data;
  }
  async getTenant(id) {
    const response = await this.client.get(`/tenants/${id}`);
    return response.data;
  }
  async updateTenant(id, params) {
    const response = await this.client.put(`/tenants/${id}`, params);
    return response.data;
  }
  async suspendTenant(id) {
    const response = await this.client.post(`/tenants/${id}/suspend`);
    return response.data;
  }
  // Notification methods
  async getNotifications() {
    const response = await this.client.get("/notifications");
    return response.data;
  }
  async markNotificationAsRead(id) {
    const response = await this.client.put(`/notifications/${id}/read`);
    return response.data;
  }
  // Utility methods
  setToken(token) {
    this.token = token;
  }
  setTenantId(tenantId) {
    this.tenantId = tenantId;
  }
};
export {
  MultiTenantSDK
};
