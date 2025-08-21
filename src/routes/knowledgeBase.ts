import { Router } from 'express';
import multer from 'multer';
import { knowledgeBaseController } from '../controllers/knowledgeBase';
import { knowledgeBaseRateLimit, addRemainingCount } from '../middleware/rateLimiter';

const router: ReturnType<typeof Router> = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'text/csv', 'application/vnd.ms-excel'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and CSV files are allowed'));
    }
  }
});

router.post('/', knowledgeBaseRateLimit, addRemainingCount, upload.single('file'), knowledgeBaseController.createKnowledgeBase);
router.get('/:token', knowledgeBaseController.getKnowledgeBase);
router.delete('/:token', knowledgeBaseController.deleteKnowledgeBase);
router.get('/', knowledgeBaseController.listKnowledgeBases);

export default router;