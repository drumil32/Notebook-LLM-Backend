import { createClient, RedisClientType } from 'redis';
import { config } from '../config';

class RedisService {
  private client: RedisClientType;
  private isConnected: boolean = false;

  constructor() {
    this.client = createClient({
      url: config.redisUrl,
    });

    this.client.on('error', (err) => {
      console.error('❌ Redis Client Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('🔗 Redis Client connecting...');
    });

    this.client.on('ready', () => {
      console.log('✅ Redis Client connected and ready');
      this.isConnected = true;
    });

    this.client.on('end', () => {
      console.log('🔌 Redis Client disconnected');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
    } catch (error) {
      console.error('❌ Failed to disconnect from Redis:', error);
      throw error;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }
    
    if (ttl) {
      await this.client.setEx(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }
    
    return await this.client.get(key);
  }

  async del(key: string): Promise<number> {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }
    
    return await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }
    
    const result = await this.client.exists(key);
    return result === 1;
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }
    
    const result = await this.client.expire(key, seconds);
    return result === 1;
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }
    
    return await this.client.keys(pattern);
  }

  async flushAll(): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }
    
    await this.client.flushAll();
  }

  getClient(): RedisClientType {
    return this.client;
  }

  isClientConnected(): boolean {
    return this.isConnected;
  }
}

export const redisService = new RedisService();