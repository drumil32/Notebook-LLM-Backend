"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRateLimit = exports.knowledgeBaseRateLimit = exports.createRateLimiter = void 0;
const redis_1 = require("../services/redis");
const createRateLimiter = ({ maxRequests, windowMs, endpointName }) => {
    return async (req, res, next) => {
        try {
            // Get IP address
            const ip = req.get('X-Real-IP') ||
                req.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
                req.ip ||
                req.connection.remoteAddress ||
                'unknown';
            // Skip rate limiting for localhost in development
            // if (process.env.NODE_ENV === 'development' && (ip === '127.0.0.1' || ip === '::1')) {
            //   return next();
            // }
            const key = `rate_limit:${endpointName}:${ip}`;
            const now = Date.now();
            const windowStart = now - windowMs;
            // Get current count for this IP
            const currentCountStr = await redis_1.redisService.get(key);
            const currentCount = currentCountStr ? parseInt(currentCountStr) : 0;
            if (currentCount >= maxRequests) {
                // Rate limit exceeded
                console.warn(`⚠️ Rate limit exceeded - IP: ${ip}, Endpoint: ${endpointName}`);
                const ttl = await redis_1.redisService.getClient().ttl(key);
                const resetTime = new Date(now + (ttl * 1000)).toISOString();
                return res.status(429).json({
                    success: false,
                    message: `Daily limit of ${maxRequests} ${endpointName} requests reached. Please try again tomorrow.`,
                    remainingRequests: 0,
                    resetTime
                });
            }
            // Increment counter
            const newCount = currentCount + 1;
            await redis_1.redisService.set(key, newCount.toString(), Math.ceil(windowMs / 1000));
            // Add remaining requests to response
            const remainingRequests = maxRequests - newCount;
            const resetTime = new Date(now + windowMs).toISOString();
            // Modify res.json to include rate limit info
            const originalJson = res.json;
            res.json = function (data) {
                if (data && typeof data === 'object') {
                    data.remainingRequests = remainingRequests;
                    data.resetTime = resetTime;
                }
                return originalJson.call(this, data);
            };
            console.log(`🔄 Rate limit check - IP: ${ip}, Count: ${newCount}/${maxRequests}, Remaining: ${remainingRequests}`);
            next();
        }
        catch (error) {
            console.error('❌ Error in rate limiter:', error);
            // On error, allow the request to proceed
            next();
        }
    };
};
exports.createRateLimiter = createRateLimiter;
// Pre-configured rate limiters
exports.knowledgeBaseRateLimit = (0, exports.createRateLimiter)({
    maxRequests: 50,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    endpointName: 'adding new knowlodge base'
});
exports.chatRateLimit = (0, exports.createRateLimiter)({
    maxRequests: 30,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours  
    endpointName: 'chat'
});
//# sourceMappingURL=rateLimiter.js.map