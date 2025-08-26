import { ChatMessage } from './knowledgeBaseAI';
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
declare class ChatService {
    private readonly CHAT_HISTORY_TTL;
    private readonly MAX_HISTORY_LENGTH;
    processChat(request: ChatRequest): Promise<ChatResult>;
    getChatHistory(token: string): Promise<ChatMessage[]>;
    clearChatHistory(token: string): Promise<boolean>;
    private getOrCreateSession;
    private getSession;
    private saveSession;
    private safeJsonParse;
    getSessionCount(): Promise<number>;
}
export declare const chatService: ChatService;
export {};
//# sourceMappingURL=chatService.d.ts.map