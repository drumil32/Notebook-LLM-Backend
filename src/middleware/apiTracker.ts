import { Request, Response, NextFunction } from 'express';
import { redisService } from '../services/redis';

interface ApiTrackerOptions {
  keyPrefix?: string;
  ttl?: number;
}

const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;

export const apiTracker = (options: ApiTrackerOptions = {}) => {
  const {
    keyPrefix = 'api_count',
    ttl = SEVEN_DAYS_IN_SECONDS
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const endpoint = `${req.method}:${req.path}`;
      const key = `${keyPrefix}:${endpoint}`;
      
      await redisService.increment(key, ttl);
      
      next();
    } catch (error) {
      console.error('❌ Error in API tracker middleware:', error);
      next();
    }
  };
};

export const getApiCounts = async (pattern: string = 'api_count:*'): Promise<Record<string, number>> => {
  try {
    const keys = await redisService.keys(pattern);
    const counts: Record<string, number> = {};
    
    for (const key of keys) {
      const count = await redisService.get(key);
      if (count) {
        const endpoint = key.replace(/^api_count:/, '');
        counts[endpoint] = parseInt(count, 10);
      }
    }
    
    return counts;
  } catch (error) {
    console.error('❌ Error getting API counts:', error);
    return {};
  }
};