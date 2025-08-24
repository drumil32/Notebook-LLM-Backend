import { Request, Response, NextFunction } from 'express';


export const validateOrigin = (req: Request, res: Response, next: NextFunction) => {
  const origin = req.get('Origin') || req.get('Referer');
  
  // Skip validation for requests without origin (like direct API calls)
  if (!origin) {
    console.warn('Request without origin header - allowing');
    return next();
  }
  
  const ip = req.get('X-Real-IP') || 
                   req.get('X-Forwarded-For')?.split(',')[0]?.trim() || 
                   req.ip || 
                   req.connection.remoteAddress || 
                   'unknown';

  // Extract the origin from referer if needed
  const requestOrigin = origin.includes('://') ? new URL(origin).origin : origin;
  
  if (config.security.allowedOrigins.length === 0) {
    console.warn('No allowed origins configured - allowing all requests');
    return next();
  }

  if (config.security.allowedOrigins.includes(requestOrigin)) {
    console.log('Origin validation passed', {
      origin: requestOrigin,
      method: req.method,
      path: req.path 
    });
    return next();
  }

  console.error('Origin validation failed - request blocked', {
    origin: requestOrigin,
    allowedOrigins: config.security.allowedOrigins,
    method: req.method,
    path: req.path,
    userAgent: req.get('User-Agent'),
    ip,
  });

  return res.status(403).json({
    error: 'Forbidden',
    message: 'Origin not allowed'
  });
};