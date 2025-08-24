"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const config_1 = require("./config");
const redis_1 = require("./services/redis");
const knowledgeBase_1 = __importDefault(require("./routes/knowledgeBase"));
const chat_1 = __importDefault(require("./routes/chat"));
const courseChat_1 = __importDefault(require("./routes/courseChat"));
const app = (0, express_1.default)();
// Trust proxy for proper IP detection (important for rate limiting)
// Trust all proxies (nginx reverse proxy)
app.set('trust proxy', true);
// Enable CORS for specific frontend URLs
app.use((0, cors_1.default)({
    origin: [config_1.config.frontendUrl1, config_1.config.frontendUrl2],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // credentials: true
}));
app.use(express_1.default.json());
// Add middleware to log all requests
app.use((req, res, next) => {
    console.log(`🌐 ${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
});
app.get('/', async (req, res) => {
    // rate_limit:${endpointName}:${ip}
    // await redisService.set('rate_limit:chat:::ffff:127.0.0.1', '0', Math.ceil(24 * 60 * 60 * 1000 / 1000));
    // await redisService.set('rate_limit:adding new knowlodge base:::ffff:127.0.0.1', '0', Math.ceil(24 * 60 * 60 * 1000 / 1000));
    res.json({ message: 'Hello World!' });
});
app.use('/chat', chat_1.default);
app.use('/knowledge-base', knowledgeBase_1.default);
app.use('/course-chat', courseChat_1.default);
async function startServer() {
    try {
        await redis_1.redisService.connect();
        app.listen(config_1.config.port, () => {
            console.log(`✅ Server is running on port ${config_1.config.port}`);
            console.log(`🌍 Environment: ${config_1.config.nodeEnv}`);
        });
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    try {
        await redis_1.redisService.disconnect();
        console.log('✅ Redis disconnected');
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
});
startServer();
//# sourceMappingURL=index.js.map