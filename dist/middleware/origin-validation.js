"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateOrigin = exports.getClientIp = void 0;
const config_1 = require("../config");
const getClientIp = (req) => {
    // Check various headers for the real client IP
    console.log(`x-real-ip ${req.get('X-Real-IP')}`);
    console.log(`x-forwarded-for ${req.get('X-Forwarded-For')}`);
    return req.get('X-Real-IP') ||
        req.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
        req.ip ||
        req.socket.remoteAddress ||
        'unknown';
};
exports.getClientIp = getClientIp;
const validateOrigin = (req, res, next) => {
    const origin = req.get('Origin') || req.get('Referer');
    console.log(origin);
    // Skip validation for requests without origin (like direct API calls)
    if (!origin) {
        console.warn('⚠️ Request without origin header - allowing');
        return next();
    }
    const ip = (0, exports.getClientIp)(req);
    // Extract the origin from referer if needed
    const requestOrigin = origin.includes('://') ? new URL(origin).origin : origin;
    // Create array of allowed origins from config
    const allowedOrigins = [config_1.config.frontendUrl1, config_1.config.frontendUrl2].filter(Boolean);
    if (allowedOrigins.length === 0) {
        console.warn('No allowed origins configured - allowing all requests');
        return next();
    }
    if (allowedOrigins.includes(requestOrigin)) {
        console.log('✅ Origin validation passed', {
            origin: requestOrigin,
            method: req.method,
            path: req.path
        });
        return next();
    }
    console.error('❌ Origin validation failed - request blocked', {
        origin: requestOrigin,
        allowedOrigins,
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
exports.validateOrigin = validateOrigin;
//# sourceMappingURL=origin-validation.js.map