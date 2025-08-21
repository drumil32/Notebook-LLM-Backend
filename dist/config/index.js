"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const requiredEnvVars = [
    'PORT',
    'NODE_ENV',
    'DATABASE_URL',
    'JWT_SECRET',
    'REDIS_URL',
    'QDRANT_URL',
    'OPENAI_API_KEY'
];
function validateEnvVars() {
    const missingVars = [];
    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            missingVars.push(envVar);
        }
    }
    if (missingVars.length > 0) {
        console.error('❌ Missing required environment variables:');
        missingVars.forEach(varName => {
            console.error(`   - ${varName}`);
        });
        console.error('\nPlease check your .env file and ensure all required variables are set.');
        process.exit(1);
    }
    return {
        port: parseInt(process.env.PORT, 10),
        nodeEnv: process.env.NODE_ENV,
        databaseUrl: process.env.DATABASE_URL,
        jwtSecret: process.env.JWT_SECRET,
        redisUrl: process.env.REDIS_URL,
        qdrantUrl: process.env.QDRANT_URL,
        qdrantApiKey: process.env.QDRANT_API_KEY,
        openaiApiKey: process.env.OPENAI_API_KEY
    };
}
exports.config = validateEnvVars();
//# sourceMappingURL=index.js.map