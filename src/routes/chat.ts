import { Router } from 'express';
import { chatController } from '../controllers/chat';

const router: ReturnType<typeof Router> = Router();

router.post('/', chatController.chat);

export default router;