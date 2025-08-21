import { Request, Response, NextFunction } from 'express';
import { redisService } from '../services/redis';

interface RateLimiterConfig {
  maxRequests: number;
  windowMs: number;
  endpointName: string;
}

export const createRateLimiter = ({ maxRequests, windowMs, endpointName }: RateLimiterConfig) => {
  return async (req: Request, res: Response, next: NextFunction) => {
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
      const currentCountStr = await redisService.get(key);
      const currentCount = currentCountStr ? parseInt(currentCountStr) : 0;

      if (currentCount >= maxRequests) {
        // Rate limit exceeded
        const ttl = await redisService.getClient().ttl(key);
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
      await redisService.set(key, newCount.toString(), Math.ceil(windowMs / 1000));

      // Add remaining requests to response
      const remainingRequests = maxRequests - newCount;
      const resetTime = new Date(now + windowMs).toISOString();

      // Modify res.json to include rate limit info
      const originalJson = res.json;
      res.json = function(data: any) {
        if (data && typeof data === 'object') {
          data.remainingRequests = remainingRequests;
          data.resetTime = resetTime;
        }
        return originalJson.call(this, data);
      };

      console.log(`🔄 Rate limit check - IP: ${ip}, Count: ${newCount}/${maxRequests}, Remaining: ${remainingRequests}`);

      next();
    } catch (error) {
      console.error('❌ Error in rate limiter:', error);
      // On error, allow the request to proceed
      next();
    }
  };
};

// Pre-configured rate limiters
export const knowledgeBaseRateLimit = createRateLimiter({
  maxRequests: 5,
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  endpointName: 'adding new knowlodge base'
});

export const chatRateLimit = createRateLimiter({
  maxRequests: 30,
  windowMs: 24 * 60 * 60 * 1000, // 24 hours  
  endpointName: 'chat'
});