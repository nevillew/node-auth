import Redis from 'ioredis';
import { TenantContext } from '../middleware/tenant-context';

export class TenantAwareCacheService {
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }

  private getTenantKey(key: string): string {
    const tenantId = TenantContext.getCurrentTenant();
    return `tenant:${tenantId}:${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const tenantKey = this.getTenantKey(key);
    const value = await this.redis.get(tenantKey);
    return value ? JSON.parse(value) : null;
  }

  async set(
    key: string,
    value: any,
    ttl?: number
  ): Promise<void> {
    const tenantKey = this.getTenantKey(key);
    const serialized = JSON.stringify(value);

    if (ttl) {
      await this.redis.setex(tenantKey, ttl, serialized);
    } else {
      await this.redis.set(tenantKey, serialized);
    }
  }

  async delete(key: string): Promise<void> {
    const tenantKey = this.getTenantKey(key);
    await this.redis.del(tenantKey);
  }

  async clearTenantCache(): Promise<void> {
    const tenantId = TenantContext.getCurrentTenant();
    const pattern = `tenant:${tenantId}:*`;
    
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
