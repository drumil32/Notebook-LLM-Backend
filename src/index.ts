import express from 'express';
import cors from 'cors';
import { config } from './config';
import { redisService } from './services/redis';
import knowledgeBaseRoutes from './routes/knowledgeBase';
import chatRoutes from './routes/chat';
import courseChatRoutes from './routes/courseChat';

const app = express();

// Trust proxy for proper IP detection (important for rate limiting)
// Trust all proxies (nginx reverse proxy)
app.set('trust proxy', true);

// Enable CORS for specific frontend URLs
app.use(cors({
  origin: [config.frontendUrl1, config.frontendUrl2],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  // credentials: true
}));

app.use(express.json());


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

app.use('/chat', chatRoutes);
app.use('/knowledge-base', knowledgeBaseRoutes);
app.use('/course-chat',courseChatRoutes);

async function startServer() {
  try {
    await redisService.connect();
    
    app.listen(config.port, () => {
      console.log(`✅ Server is running on port ${config.port}`);
      console.log(`🌍 Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  try {
    await redisService.disconnect();
    console.log('✅ Redis disconnected');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

startServer();