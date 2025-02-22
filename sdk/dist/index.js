var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  MultiTenantSDK: () => MultiTenantSDK
});
module.exports = __toCommonJS(src_exports);
var import_axios = __toESM(require("axios"));
var MultiTenantSDK = class {
  client;
  token;
  tenantId;
  constructor(config) {
    this.token = config.token;
    this.tenantId = config.tenantId;
    this.client = import_axios.default.create({
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MultiTenantSDK
});
