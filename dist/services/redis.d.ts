import { RedisClientType } from 'redis';
declare class RedisService {
    private client;
    private isConnected;
    constructor();
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    set(key: string, value: string, ttl?: number): Promise<void>;
    get(key: string): Promise<string | null>;
    del(key: string): Promise<number>;
    exists(key: string): Promise<boolean>;
    expire(key: string, seconds: number): Promise<boolean>;
    keys(pattern: string): Promise<string[]>;
    getKeys(pattern: string): Promise<string[]>;
    ttl(key: string): Promise<number>;
    flushAll(): Promise<void>;
    getClient(): RedisClientType;
    isClientConnected(): boolean;
}
export declare const redisService: RedisService;
export {};
//# sourceMappingURL=redis.d.ts.map