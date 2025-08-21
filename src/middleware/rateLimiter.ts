import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

interface RateLimiterConfig {
  maxRequests: number;
  endpointName: string;
}

export const createRateLimiter = ({ maxRequests, endpointName }: RateLimiterConfig) => {
  return rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours (1 day)
    max: maxRequests,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => {
      return req.ip || req.connection.remoteAddress || 'anonymous';
    },
    skip: (req) => {
      const ip = req.get('X-Real-IP') || 
           req.get('X-Forwarded-For')?.split(',')[0]?.trim() || 
           req.ip || 
           req.connection.remoteAddress || 
           'unknown';
      return process.env.NODE_ENV === 'development' && (ip === '127.0.0.1' || ip === '::1');
    },
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        message: `Daily limit of ${maxRequests} ${endpointName} requests reached. Please try again tomorrow.`,
        remainingRequests: 0,
        resetTime: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString()
      });
    },
    // onLimitReached: (req: Request, res: Response) => {
    //   console.log(`🚫 Rate limit reached for ${endpointName} from IP: ${req.ip}`);
    // }
  });
};

// Add middleware to inject remaining requests count
export const addRemainingCount = (req: Request, res: Response, next: any) => {
  const originalJson = res.json;
  
  res.json = function(data: any) {
    // Get rate limit info from headers
    const remaining = res.getHeader('RateLimit-Remaining');
    const resetTime = res.getHeader('RateLimit-Reset');
    
    if (remaining !== undefined && data && typeof data === 'object') {
      data.remainingRequests = parseInt(remaining as string);
      if (resetTime) {
        data.resetTime = new Date(parseInt(resetTime as string) * 1000).toISOString();
      }
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

// Pre-configured rate limiters
export const knowledgeBaseRateLimit = createRateLimiter({
  maxRequests: 5,
  endpointName: 'knowledge base creation'
});

export const chatRateLimit = createRateLimiter({
  maxRequests: 30,
  endpointName: 'chat'
});