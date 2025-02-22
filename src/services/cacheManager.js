const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const logger = require('../config/logger');

class CacheManager {
  constructor() {
    this.cacheDir = '.analyzer-cache';
    this.cacheMap = new Map();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize cache:', error);
    }
  }

  getCacheKey(filePath, content) {
    const hash = crypto.createHash('sha256');
    hash.update(content);
    return path.join(this.cacheDir, `${path.basename(filePath)}.${hash.digest('hex')}.cache`);
  }

  async get(filePath) {
    await this.init();

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const cacheKey = this.getCacheKey(filePath, content);
      
      if (this.cacheMap.has(cacheKey)) {
        return this.cacheMap.get(cacheKey);
      }

      const cacheFile = await fs.readFile(cacheKey, 'utf8');
      const cached = JSON.parse(cacheFile);
      this.cacheMap.set(cacheKey, cached);
      
      return cached;
    } catch (error) {
      return null;
    }
  }

  async set(filePath, content, data) {
    await this.init();

    try {
      const cacheKey = this.getCacheKey(filePath, content);
      this.cacheMap.set(cacheKey, data);
      
      await fs.writeFile(
        cacheKey,
        JSON.stringify(data),
        'utf8'
      );
    } catch (error) {
      logger.error('Failed to write cache:', error);
    }
  }

  async clear() {
    try {
      await fs.rm(this.cacheDir, { recursive: true, force: true });
      this.cacheMap.clear();
      this.initialized = false;
    } catch (error) {
      logger.error('Failed to clear cache:', error);
    }
  }
}

module.exports = {
  cacheManager: new CacheManager()
};
