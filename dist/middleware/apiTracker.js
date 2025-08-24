"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApiCounts = exports.apiTracker = void 0;
const redis_1 = require("../services/redis");
const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;
const apiTracker = (options = {}) => {
    const { keyPrefix = 'api_count', ttl = SEVEN_DAYS_IN_SECONDS } = options;
    return async (req, res, next) => {
        try {
            const endpoint = `${req.method}:${req.path}`;
            const key = `${keyPrefix}:${endpoint}`;
            await redis_1.redisService.increment(key, ttl);
            next();
        }
        catch (error) {
            console.error('❌ Error in API tracker middleware:', error);
            next();
        }
    };
};
exports.apiTracker = apiTracker;
const getApiCounts = async (pattern = 'api_count:*') => {
    try {
        const keys = await redis_1.redisService.keys(pattern);
        const counts = {};
        for (const key of keys) {
            const count = await redis_1.redisService.get(key);
            if (count) {
                const endpoint = key.replace(/^api_count:/, '');
                counts[endpoint] = parseInt(count, 10);
            }
        }
        return counts;
    }
    catch (error) {
        console.error('❌ Error getting API counts:', error);
        return {};
    }
};
exports.getApiCounts = getApiCounts;
//# sourceMappingURL=apiTracker.js.map