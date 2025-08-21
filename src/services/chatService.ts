import { knowledgeBaseAI, ChatMessage } from './knowledgeBaseAI';
import { redisService } from './redis';
import { KnowledgeBaseData } from './knowledgeBase';

export interface ChatRequest {
  message: string;
  token: string;
}

export interface ChatResult {
  success: boolean;
  message?: string;
  error?: string;
  sessionId?: string;
}

export interface ChatSession {
  token: string;
  history: ChatMessage[];
  knowledgeBase: KnowledgeBaseData;
  createdAt: Date;
  lastActivity: Date;
}

class ChatService {
  private readonly CHAT_HISTORY_TTL = 3600; // 1 hour in seconds
  private readonly MAX_HISTORY_LENGTH = 100; // Limit chat history to prevent memory issues

  async processChat(request: ChatRequest): Promise<ChatResult> {
    const { message, token } = request;

    if (!message?.trim()) {
      return {
        success: false,
        error: 'Message cannot be empty'
      };
    }

    if (!token?.trim()) {
      return {
        success: false,
        error: 'Session token is required'
      };
    }

    try {
      const session = await this.getOrCreateSession(token);
      
      if (!session) {
        return {
          success: false,
          error: 'Session expired or not found. Please upload your documents again.'
        };
      }

      // Add user message to history
      const userMessage: ChatMessage = {
        role: 'user',
        content: message.trim(),
        timestamp: new Date()
      };

      session.history.push(userMessage);

      // Get AI response
      const aiResponse = await knowledgeBaseAI.processMessage(
        message, 
        session.knowledgeBase, 
        session.history
      );

      // Add AI response to history
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      };

      session.history.push(assistantMessage);
      session.lastActivity = new Date();

      // Trim history if too long
      if (session.history.length > this.MAX_HISTORY_LENGTH) {
        session.history = session.history.slice(-this.MAX_HISTORY_LENGTH);
      }

      // Save updated session
      await this.saveSession(session);

      console.log(`💬 Chat processed:`, {
        token: token.substring(0, 8) + '...',
        messageLength: message.length,
        responseLength: aiResponse.length,
        historyCount: session.history.length
      });

      return {
        success: true,
        message: aiResponse,
        sessionId: token
      };

    } catch (error) {
      console.error('❌ Error in chat service:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('Failed to process')) {
          return {
            success: false,
            error: 'Unable to process your message. Please try rephrasing your question.'
          };
        }
        
        if (error.message.includes('knowledge base')) {
          return {
            success: false,
            error: 'Knowledge base unavailable. Please try again later.'
          };
        }
      }

      return {
        success: false,
        error: 'An unexpected error occurred. Please try again.'
      };
    }
  }

  async getChatHistory(token: string): Promise<ChatMessage[]> {
    try {
      const session = await this.getSession(token);
      return session?.history || [];
    } catch (error) {
      console.error('Error getting chat history:', error);
      return [];
    }
  }

  async clearChatHistory(token: string): Promise<boolean> {
    try {
      const session = await this.getSession(token);
      if (session) {
        session.history = [];
        session.lastActivity = new Date();
        await this.saveSession(session);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error clearing chat history:', error);
      return false;
    }
  }

  private async getOrCreateSession(token: string): Promise<ChatSession | null> {
    try {
      // Try to get existing session
      const existingSession = await this.getSession(token);
      if (existingSession) {
        return existingSession;
      }

      // If no session exists, create one from knowledge base
      const knowledgeBaseKey = `knowledge_base:${token}`;
      const knowledgeBaseData = await redisService.get(knowledgeBaseKey);
      
      if (!knowledgeBaseData) {
        return null;
      }

      const knowledgeBase = this.safeJsonParse<KnowledgeBaseData>(knowledgeBaseData);
      if (!knowledgeBase) {
        return null;
      }

      const newSession: ChatSession = {
        token,
        history: [],
        knowledgeBase,
        createdAt: new Date(),
        lastActivity: new Date()
      };

      await this.saveSession(newSession);
      return newSession;

    } catch (error) {
      console.error('Error getting or creating session:', error);
      return null;
    }
  }

  private async getSession(token: string): Promise<ChatSession | null> {
    try {
      const sessionKey = `chat_session:${token}`;
      const sessionData = await redisService.get(sessionKey);
      
      if (!sessionData) {
        return null;
      }

      return this.safeJsonParse<ChatSession>(sessionData);
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  private async saveSession(session: ChatSession): Promise<void> {
    try {
      const sessionKey = `chat_session:${session.token}`;
      await redisService.set(
        sessionKey, 
        JSON.stringify(session), 
        this.CHAT_HISTORY_TTL
      );
    } catch (error) {
      console.error('Error saving session:', error);
      throw new Error('Failed to save chat session');
    }
  }

  private safeJsonParse<T>(jsonString: string): T | null {
    try {
      return JSON.parse(jsonString) as T;
    } catch (error) {
      console.error('JSON parse error:', error);
      return null;
    }
  }

  // Health check method
  async getSessionCount(): Promise<number> {
    try {
      const keys = await redisService.getKeys('chat_session:*');
      return keys.length;
    } catch (error) {
      console.error('Error getting session count:', error);
      return 0;
    }
  }
}

export const chatService = new ChatService();