import { Request, Response, NextFunction } from 'express';
interface ApiTrackerOptions {
    keyPrefix?: string;
    ttl?: number;
}
export declare const apiTracker: (options?: ApiTrackerOptions) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getApiCounts: (pattern?: string) => Promise<Record<string, number>>;
export {};
//# sourceMappingURL=apiTracker.d.ts.map