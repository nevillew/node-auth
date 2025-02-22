const NodeCache = require('node-cache');

class FallbackCache {
  constructor() {
    this.cache = new NodeCache({
      stdTTL: 600, // 10 minutes default TTL
      checkperiod: 120, // Check for expired keys every 2 minutes
      useClones: false
    });
    this.isRedisDown = false;
  }

  async get(key) {
    return this.cache.get(key);
  }

  async set(key, value, ttl) {
    return this.cache.set(key, value, ttl);
  }

  async del(key) {
    return this.cache.del(key);
  }

  async incr(key) {
    const value = (this.cache.get(key) || 0) + 1;
    this.cache.set(key, value);
    return value;
  }

  async expire(key, seconds) {
    const value = this.cache.get(key);
    if (value) {
      return this.cache.set(key, value, seconds);
    }
    return false;
  }
}

module.exports = new FallbackCache();
