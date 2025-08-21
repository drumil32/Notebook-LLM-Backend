export interface KnowledgeBaseInput {
    text?: string;
    file?: Express.Multer.File;
    link?: string;
    youtubeUrl?: string;
}
export interface ValidationError {
    field: string;
    message: string;
}
export interface KnowledgeBaseResponse {
    success: boolean;
    token?: string;
    errors?: ValidationError[];
}
export interface KnowledgeBaseData {
    token: string;
    text?: string;
    link?: string;
    fileInfo?: {
        filename: string;
        size: number;
        mimetype: string;
        collectionName?: string;
        documentCount?: number;
    };
    linkInfo?: {
        url: string;
        collectionName?: string;
        documentCount?: number;
        chunkCount?: number;
        crawlDepth?: 'single' | 'site';
    };
    youtubeInfo?: {
        url: string;
        collectionName?: string;
        documentCount?: number;
        chunkCount?: number;
        videoInfo?: {
            title?: string;
            author?: string;
            length?: string;
            description?: string;
        };
    };
    textInfo?: {
        collectionName?: string;
        documentCount?: number;
        chunkCount?: number;
    };
    createdAt: string;
    expiresAt: string;
}
declare class KnowledgeBaseService {
    private readonly TEXT_LIMIT;
    private readonly FILE_SIZE_LIMIT;
    private readonly ALLOWED_FILE_TYPES;
    private readonly REDIS_KEY_PREFIX;
    private readonly TTL_SECONDS;
    processKnowledgeBase(input: KnowledgeBaseInput): Promise<KnowledgeBaseResponse>;
    private validateInput;
    private countWords;
    private isValidUrl;
    private isValidYouTubeUrl;
    getKnowledgeBase(token: string): Promise<KnowledgeBaseData | null>;
    deleteKnowledgeBase(token: string): Promise<boolean>;
    listKnowledgeBases(): Promise<string[]>;
}
export declare const knowledgeBaseService: KnowledgeBaseService;
export {};
//# sourceMappingURL=knowledgeBase.d.ts.map