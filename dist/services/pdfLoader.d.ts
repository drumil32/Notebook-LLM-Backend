export interface PDFProcessingResult {
    success: boolean;
    collectionName?: string;
    documentCount?: number;
    chunkCount?: number;
    error?: string;
}
declare class PDFLoaderService {
    private readonly embeddings;
    constructor();
    processPDF(buffer: Buffer, token: string): Promise<PDFProcessingResult>;
    deleteCollection(token: string): Promise<boolean>;
}
export declare const pdfLoaderService: PDFLoaderService;
export {};
//# sourceMappingURL=pdfLoader.d.ts.map