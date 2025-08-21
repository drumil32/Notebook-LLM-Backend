export interface TextProcessingResult {
    success: boolean;
    collectionName?: string;
    documentCount?: number;
    chunkCount?: number;
    error?: string;
}
declare class TextLoaderService {
    private readonly embeddings;
    private readonly textSplitter;
    constructor();
    processText(text: string, token: string): Promise<TextProcessingResult>;
    deleteCollection(token: string): Promise<boolean>;
}
export declare const textLoaderService: TextLoaderService;
export {};
//# sourceMappingURL=textLoader.d.ts.map