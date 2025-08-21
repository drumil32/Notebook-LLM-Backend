export interface YouTubeProcessingResult {
    success: boolean;
    collectionName?: string;
    documentCount?: number;
    chunkCount?: number;
    videoInfo?: {
        title?: string;
        author?: string;
        length?: string;
        description?: string;
    };
    error?: string;
}
export interface YouTubeProcessingOptions {
    language?: string;
    chunkSize?: number;
    chunkOverlap?: number;
}
declare class YouTubeLoaderService {
    private readonly embeddings;
    private readonly textSplitter;
    constructor();
    processYouTube(videoUrl: string, token: string, options?: YouTubeProcessingOptions): Promise<YouTubeProcessingResult>;
    private isValidYouTubeUrl;
    private extractVideoId;
    deleteCollection(token: string): Promise<boolean>;
}
export declare const youtubeLoaderService: YouTubeLoaderService;
export {};
//# sourceMappingURL=youtubeLoader.d.ts.map