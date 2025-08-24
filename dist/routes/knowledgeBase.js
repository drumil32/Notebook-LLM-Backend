"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const knowledgeBase_1 = require("../controllers/knowledgeBase");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'text/csv', 'application/vnd.ms-excel'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Only PDF and CSV files are allowed'));
        }
    }
});
router.post('/', rateLimiter_1.knowledgeBaseRateLimit, upload.single('file'), knowledgeBase_1.knowledgeBaseController.createKnowledgeBase);
router.get('/:token', knowledgeBase_1.knowledgeBaseController.getKnowledgeBase);
router.delete('/:token', knowledgeBase_1.knowledgeBaseController.deleteKnowledgeBase);
router.get('/', knowledgeBase_1.knowledgeBaseController.listKnowledgeBases);
exports.default = router;
//# sourceMappingURL=knowledgeBase.js.map