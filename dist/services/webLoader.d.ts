export interface WebProcessingResult {
    success: boolean;
    collectionName?: string;
    documentCount?: number;
    chunkCount?: number;
    error?: string;
}
export interface WebProcessingOptions {
    maxPages?: number;
    chunkSize?: number;
    chunkOverlap?: number;
    crawlDepth?: 'single' | 'site';
}
declare class WebLoaderService {
    private readonly embeddings;
    private textSplitter;
    constructor();
    private discoverLinks;
    private loadMultipleUrls;
    processWebsite(url: string, token: string, options?: WebProcessingOptions): Promise<WebProcessingResult>;
    deleteCollection(token: string): Promise<boolean>;
}
export declare const webLoaderService: WebLoaderService;
export {};
//# sourceMappingURL=webLoader.d.ts.map