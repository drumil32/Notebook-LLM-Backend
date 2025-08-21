"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisService = void 0;
const redis_1 = require("redis");
const config_1 = require("../config");
class RedisService {
    constructor() {
        this.isConnected = false;
        this.client = (0, redis_1.createClient)({
            url: config_1.config.redisUrl,
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
    async connect() {
        try {
            await this.client.connect();
        }
        catch (error) {
            console.error('❌ Failed to connect to Redis:', error);
            throw error;
        }
    }
    async disconnect() {
        try {
            await this.client.disconnect();
        }
        catch (error) {
            console.error('❌ Failed to disconnect from Redis:', error);
            throw error;
        }
    }
    async set(key, value, ttl) {
        if (!this.isConnected) {
            throw new Error('Redis client is not connected');
        }
        if (ttl) {
            await this.client.setEx(key, ttl, value);
        }
        else {
            await this.client.set(key, value);
        }
    }
    async get(key) {
        if (!this.isConnected) {
            throw new Error('Redis client is not connected');
        }
        return await this.client.get(key);
    }
    async del(key) {
        if (!this.isConnected) {
            throw new Error('Redis client is not connected');
        }
        return await this.client.del(key);
    }
    async exists(key) {
        if (!this.isConnected) {
            throw new Error('Redis client is not connected');
        }
        const result = await this.client.exists(key);
        return result === 1;
    }
    async expire(key, seconds) {
        if (!this.isConnected) {
            throw new Error('Redis client is not connected');
        }
        const result = await this.client.expire(key, seconds);
        return result === 1;
    }
    async keys(pattern) {
        if (!this.isConnected) {
            throw new Error('Redis client is not connected');
        }
        return await this.client.keys(pattern);
    }
    async getKeys(pattern) {
        return await this.keys(pattern);
    }
    async ttl(key) {
        if (!this.isConnected) {
            throw new Error('Redis client is not connected');
        }
        return await this.client.ttl(key);
    }
    async flushAll() {
        if (!this.isConnected) {
            throw new Error('Redis client is not connected');
        }
        await this.client.flushAll();
    }
    getClient() {
        return this.client;
    }
    isClientConnected() {
        return this.isConnected;
    }
}
exports.redisService = new RedisService();
//# sourceMappingURL=redis.js.map