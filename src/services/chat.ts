import { redisService } from './redis';

export interface ChatResult {
  success: boolean;
  error?: string;
}

class ChatService {
  async processChat(message: string, token: string): Promise<ChatResult> {
    try {
      const knowledgeBaseKey = `knowledge_base:${token}`;
      const knowledgeBase = await redisService.get(knowledgeBaseKey);

      if (!knowledgeBase) {
        return {
          success: false,
          error: 'Session expired or not found'
        };
      }

      console.log(`📝 Chat request received:`, {
        message,
        token,
        knowledgeBaseFound: true,
        knowledgeBase: JSON.parse(knowledgeBase)
      });

      return {
        success: true
      };
    } catch (error) {
      console.error('❌ Error in chat service:', error);
      return {
        success: false,
        error: 'Failed to process chat request'
      };
    }
  }
}

export const chatService = new ChatService();