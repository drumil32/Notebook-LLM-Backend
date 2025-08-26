"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chat_1 = require("../controllers/chat");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
router.post('/', rateLimiter_1.chatRateLimit, chat_1.chatController.chat);
exports.default = router;
//# sourceMappingURL=chat.js.map