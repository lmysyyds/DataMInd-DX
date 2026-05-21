const { createClient } = require('redis');

class CacheService {
  constructor() {
    this.client = null;
    this.connect();
  }

  async connect() {
    try {
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      this.client.on('error', (err) => {
        console.error('Redis client error:', err);
      });

      this.client.on('connect', () => {
        console.log('Redis connected');
      });

      await this.client.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      // 如果Redis连接失败，使用内存缓存作为 fallback
      this.useMemoryCache();
    }
  }

  // 使用内存缓存作为 fallback
  useMemoryCache() {
    console.log('Using memory cache as fallback');
    this.memoryCache = new Map();
  }

  // 设置缓存
  async set(key, value, expiration = 3600) {
    try {
      if (this.client && this.client.isReady) {
        await this.client.set(key, JSON.stringify(value), {
          EX: expiration
        });
      } else if (this.memoryCache) {
        this.memoryCache.set(key, {
          value,
          expiresAt: Date.now() + (expiration * 1000)
        });
      }
    } catch (error) {
      console.error('Error setting cache:', error);
    }
  }

  // 获取缓存
  async get(key) {
    try {
      if (this.client && this.client.isReady) {
        const value = await this.client.get(key);
        return value ? JSON.parse(value) : null;
      } else if (this.memoryCache) {
        const item = this.memoryCache.get(key);
        if (item && item.expiresAt > Date.now()) {
          return item.value;
        } else if (item) {
          this.memoryCache.delete(key);
        }
        return null;
      }
      return null;
    } catch (error) {
      console.error('Error getting cache:', error);
      return null;
    }
  }

  // 删除缓存
  async delete(key) {
    try {
      if (this.client && this.client.isReady) {
        await this.client.del(key);
      } else if (this.memoryCache) {
        this.memoryCache.delete(key);
      }
    } catch (error) {
      console.error('Error deleting cache:', error);
    }
  }

  // 清除所有缓存
  async clear() {
    try {
      if (this.client && this.client.isReady) {
        await this.client.flushAll();
      } else if (this.memoryCache) {
        this.memoryCache.clear();
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  // 生成缓存键
  generateKey(prefix, ...params) {
    return `${prefix}:${params.join(':')}`;
  }
}

module.exports = new CacheService();