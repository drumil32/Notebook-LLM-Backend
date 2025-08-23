"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rateLimiter_1 = require("../middleware/rateLimiter");
const courseChat_1 = require("../controllers/courseChat");
const router = (0, express_1.Router)();
router.post('/', rateLimiter_1.chatRateLimit, courseChat_1.courseChatController.chat.bind(courseChat_1.courseChatController));
exports.default = router;
//# sourceMappingURL=courseChat.js.map