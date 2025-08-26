"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatService = void 0;
const knowledgeBaseAI_1 = require("./knowledgeBaseAI");
const redis_1 = require("./redis");
class ChatService {
    constructor() {
        this.CHAT_HISTORY_TTL = 3600; // 1 hour in seconds
        this.MAX_HISTORY_LENGTH = 100; // Limit chat history to prevent memory issues
    }
    async processChat(request) {
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
            const userMessage = {
                role: 'user',
                content: message.trim(),
                timestamp: new Date()
            };
            session.history.push(userMessage);
            // Get AI response
            const aiResponse = await knowledgeBaseAI_1.knowledgeBaseAI.processMessage(message, session.knowledgeBase, session.history);
            // Add AI response to history
            const assistantMessage = {
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
        }
        catch (error) {
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
    async getChatHistory(token) {
        try {
            const session = await this.getSession(token);
            return session?.history || [];
        }
        catch (error) {
            console.error('Error getting chat history:', error);
            return [];
        }
    }
    async clearChatHistory(token) {
        try {
            const session = await this.getSession(token);
            if (session) {
                session.history = [];
                session.lastActivity = new Date();
                await this.saveSession(session);
                return true;
            }
            return false;
        }
        catch (error) {
            console.error('Error clearing chat history:', error);
            return false;
        }
    }
    async getOrCreateSession(token) {
        try {
            // Try to get existing session
            const existingSession = await this.getSession(token);
            if (existingSession) {
                return existingSession;
            }
            // If no session exists, create one from knowledge base
            const knowledgeBaseKey = `knowledge_base:${token}`;
            const knowledgeBaseData = await redis_1.redisService.get(knowledgeBaseKey);
            if (!knowledgeBaseData) {
                return null;
            }
            const knowledgeBase = this.safeJsonParse(knowledgeBaseData);
            if (!knowledgeBase) {
                return null;
            }
            const newSession = {
                token,
                history: [],
                knowledgeBase,
                createdAt: new Date(),
                lastActivity: new Date()
            };
            await this.saveSession(newSession);
            return newSession;
        }
        catch (error) {
            console.error('Error getting or creating session:', error);
            return null;
        }
    }
    async getSession(token) {
        try {
            const sessionKey = `chat_session:${token}`;
            const sessionData = await redis_1.redisService.get(sessionKey);
            if (!sessionData) {
                return null;
            }
            return this.safeJsonParse(sessionData);
        }
        catch (error) {
            console.error('Error getting session:', error);
            return null;
        }
    }
    async saveSession(session) {
        try {
            const sessionKey = `chat_session:${session.token}`;
            await redis_1.redisService.set(sessionKey, JSON.stringify(session), this.CHAT_HISTORY_TTL);
        }
        catch (error) {
            console.error('Error saving session:', error);
            throw new Error('Failed to save chat session');
        }
    }
    safeJsonParse(jsonString) {
        try {
            return JSON.parse(jsonString);
        }
        catch (error) {
            console.error('JSON parse error:', error);
            return null;
        }
    }
    // Health check method
    async getSessionCount() {
        try {
            const keys = await redis_1.redisService.getKeys('chat_session:*');
            return keys.length;
        }
        catch (error) {
            console.error('Error getting session count:', error);
            return 0;
        }
    }
}
exports.chatService = new ChatService();
//# sourceMappingURL=chatService.js.map