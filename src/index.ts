import express from 'express';
import cors from 'cors';
import { config } from './config';
import { redisService } from './services/redis';
import knowledgeBaseRoutes from './routes/knowledgeBase';
import chatRoutes from './routes/chat';
import courseChatRoutes from './routes/courseChat';

const app = express();

// Trust proxy for proper IP detection (important for rate limiting)
app.set('trust proxy', 'loopback');

// Enable CORS for all routes and origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

app.use(express.json());


// Add middleware to log all requests
app.use((req, res, next) => {
  console.log(`🌐 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

app.get('/', (req, res) => {
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