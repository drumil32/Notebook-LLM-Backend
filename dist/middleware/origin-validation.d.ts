import { Request, Response, NextFunction } from 'express';
export declare const getClientIp: (req: Request) => string;
export declare const validateOrigin: (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
//# sourceMappingURL=origin-validation.d.ts.map