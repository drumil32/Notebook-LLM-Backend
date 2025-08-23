export interface TranscriptSegment {
    text: string;
    start: number;
    duration: number;
}
export interface CombinedTranscriptSegment {
    text: string;
    start: number;
    duration: number;
}
export interface VideoInfo {
    title: string;
    author: string;
    length: string;
    description: string;
    videoId: string;
}
export interface YouTubeProcessingResult {
    success: boolean;
    collectionName?: string;
    documentCount?: number;
    chunkCount?: number;
    videoInfo?: VideoInfo;
    error?: string;
}
export interface YouTubeProcessingOptions {
    language?: string;
    chunkSize?: number;
    chunkOverlap?: number;
    minDurationMinutes?: number;
    collectionName?: string;
}
export interface DocumentMetadata {
    videoName: string;
    videoLink: string;
    timestampedVideoLink: string;
    startTime: number;
    duration: number;
    endTime: number;
    originalSegmentIndex: number;
    chunkIndex?: number;
    approximateStartTime?: number;
    approximateDuration?: number;
    chunkLength?: number;
    isChunked?: boolean;
}
declare class YouTubeLoaderService {
    private readonly openAIEmbeddings;
    private readonly googleEmbeddings;
    private readonly textSplitter;
    constructor();
    private createTranscript;
    private combineToMinDuration;
    private createEmbeddingsFromSubtitles;
    private getYoutubeUrl;
    processYouTube(videoUrl: string, token: string, options?: YouTubeProcessingOptions): Promise<YouTubeProcessingResult>;
    private isValidYouTubeUrl;
    private extractVideoId;
    deleteCollection(token: string): Promise<boolean>;
}
export declare const youtubeLoaderService: YouTubeLoaderService;
export {};
//# sourceMappingURL=youtubeLoader.d.ts.map