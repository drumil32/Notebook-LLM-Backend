import { Router } from 'express';
import { chatRateLimit, courseChatRateLimit } from '../middleware/rateLimiter';
import { courseChatController } from '../controllers/courseChat';

const router: ReturnType<typeof Router> = Router();

router.post('/', courseChatRateLimit, courseChatController.chat.bind(courseChatController));

export default router;