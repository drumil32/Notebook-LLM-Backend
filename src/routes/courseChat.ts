import { Router } from 'express';
import { chatRateLimit } from '../middleware/rateLimiter';
import { courseChatController } from '../controllers/courseChat';

const router: ReturnType<typeof Router> = Router();

router.post('/', chatRateLimit, courseChatController.chat.bind(courseChatController));

export default router;