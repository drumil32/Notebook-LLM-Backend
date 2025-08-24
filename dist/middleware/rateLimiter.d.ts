import { Request, Response, NextFunction } from 'express';
interface RateLimiterConfig {
    maxRequests: number;
    windowMs: number;
    endpointName: string;
}
export declare const createRateLimiter: ({ maxRequests, windowMs, endpointName }: RateLimiterConfig) => (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const knowledgeBaseRateLimit: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const chatRateLimit: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const courseChatRateLimit: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export {};
//# sourceMappingURL=rateLimiter.d.ts.map