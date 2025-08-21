import { Router } from 'express';
import { chatController } from '../controllers/chat';
import { chatRateLimit, addRemainingCount } from '../middleware/rateLimiter';

const router: ReturnType<typeof Router> = Router();

router.post('/', chatRateLimit, addRemainingCount, chatController.chat);

export default router;