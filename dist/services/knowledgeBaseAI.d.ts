import { KnowledgeBaseData } from "./knowledgeBase";
export interface AIResponse {
    content: string;
    sources: string[];
}
export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: Date;
}
declare class KnowledgeBaseAI {
    private readonly embeddings;
    private readonly openaiClient;
    private readonly systemPrompts;
    constructor();
    processMessage(message: string, knowledgeBaseData: KnowledgeBaseData, chatHistory?: ChatMessage[]): Promise<string>;
    private getAnswerFromSource;
    private combineAnswers;
}
export declare const knowledgeBaseAI: KnowledgeBaseAI;
export {};
//# sourceMappingURL=knowledgeBaseAI.d.ts.map