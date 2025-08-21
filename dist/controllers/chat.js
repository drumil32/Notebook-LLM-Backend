"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatController = exports.ChatController = void 0;
const chatService_1 = require("../services/chatService");
class ChatController {
    async chat(req, res) {
        try {
            if (!req.body) {
                res.status(400).json({
                    success: false,
                    message: 'Request body is required'
                });
                return;
            }
            const { message, token } = req.body;
            if (!message || !token) {
                res.status(400).json({
                    success: false,
                    message: 'Both message and token are required'
                });
                return;
            }
            const result = await chatService_1.chatService.processChat({ message, token });
            if (!result.success) {
                res.status(400).json({
                    success: false,
                    message: result.error || 'Failed to process chat'
                });
                return;
            }
            res.status(200).json({
                success: true,
                message: result.message,
                sessionId: result.sessionId
            });
        }
        catch (error) {
            console.error('Error in chat controller:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
}
exports.ChatController = ChatController;
exports.chatController = new ChatController();
//# sourceMappingURL=chat.js.map