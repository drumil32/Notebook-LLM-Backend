import { Router } from 'express';
import { chatController } from '../controllers/chat';
import { chatRateLimit } from '../middleware/rateLimiter';

const router: ReturnType<typeof Router> = Router();

router.post('/', chatRateLimit, chatController.chat);

export default router;