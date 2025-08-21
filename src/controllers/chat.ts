import { Request, Response } from 'express';
import { chatService } from '../services/chat';

export class ChatController {
  async chat(req: Request, res: Response): Promise<void> {
    try {
      const { message, token } = req.body;

      if (!message || !token) {
        res.status(400).json({
          success: false,
          message: 'Both message and token are required'
        });
        return;
      }

      const result = await chatService.processChat(message, token);

      if (!result.success) {
        res.status(404).json({
          success: false,
          message: result.error || 'Session expired or not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Knowledge base found and logged'
      });
    } catch (error) {
      console.error('Error in chat:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export const chatController = new ChatController();