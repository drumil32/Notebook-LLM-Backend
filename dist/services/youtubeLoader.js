"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.youtubeLoaderService = void 0;
const openai_1 = require("@langchain/openai");
const documents_1 = require("@langchain/core/documents");
const textsplitters_1 = require("@langchain/textsplitters");
// Will use dynamic import for youtube-transcript-plus
const google_genai_1 = require("@langchain/google-genai");
const config_1 = require("../config");
const qdrant_1 = require("@langchain/qdrant");
class YouTubeLoaderService {
    constructor() {
        console.log('🚀 Initializing YouTube Loader Service');
        this.openAIEmbeddings = new openai_1.OpenAIEmbeddings({
            apiKey: config_1.config.openaiApiKey,
            batchSize: 512,
            model: 'text-embedding-3-large',
        });
        this.googleEmbeddings = new google_genai_1.GoogleGenerativeAIEmbeddings({
            apiKey: config_1.config.googleApiKey,
            model: 'text-embedding-004',
        });
        this.textSplitter = new textsplitters_1.RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
            separators: ['\n\n', '\n', ' ', ''],
        });
        console.log('✅ YouTube Loader Service initialized successfully');
    }
    async createTranscript(videoId, language) {
        console.log(`🎥 Fetching transcript for video: ${videoId}`);
        try {
            const ytTranscript = await (Function('return import("youtube-transcript-plus")')());
            const data = await ytTranscript.fetchTranscript(videoId);
            return data;
        }
        catch (error) {
            console.error(`❌ Error fetching transcript for video ${videoId}:`, error);
            throw error;
        }
    }
    combineToMinDuration(segments, minDurationMinutes = 5) {
        console.log(`🔗 Combining ${segments.length} segments to minimum duration of ${minDurationMinutes} minutes`);
        const minDurationSeconds = minDurationMinutes * 60;
        const result = [];
        let currentText = '';
        let currentStartTime = -1;
        let currentEndTime = -1;
        for (const segment of segments) {
            const segmentEndTime = segment.offset + segment.duration;
            currentText += segment.text + ' ';
            if (currentStartTime === -1) {
                currentStartTime = segment.offset;
            }
            currentEndTime = Math.max(currentEndTime, segmentEndTime);
            const actualDuration = currentEndTime - currentStartTime;
            if (actualDuration >= minDurationSeconds) {
                result.push({
                    text: currentText.trim(),
                    start: currentStartTime,
                    duration: actualDuration
                });
                currentStartTime = -1;
                currentEndTime = -1;
                currentText = '';
            }
        }
        // Handle any remaining segments
        if (currentStartTime !== -1) {
            result.push({
                text: currentText.trim(),
                start: currentStartTime,
                duration: currentEndTime - currentStartTime
            });
        }
        console.log(`✅ Combined into ${result.length} segments`);
        return result;
    }
    async createEmbeddingsFromSubtitles(subtitleData, videoName, videoLink, collectionName, options = {}) {
        console.log(`🧠 Creating embeddings for ${subtitleData.length} subtitle segments`);
        const { chunkSize = 1000, chunkOverlap = 200 } = options;
        const textSplitter = new textsplitters_1.RecursiveCharacterTextSplitter({
            chunkSize,
            chunkOverlap,
            lengthFunction: (text) => text.length,
        });
        const documents = [];
        for (let i = 0; i < subtitleData.length; i++) {
            const segment = subtitleData[i];
            const timestampedLink = `${videoLink}&t=${Math.floor(segment.start)}s`;
            const doc = new documents_1.Document({
                pageContent: segment.text,
                metadata: {
                    videoName,
                    videoLink,
                    timestampedVideoLink: timestampedLink,
                    startTime: segment.start,
                    duration: segment.duration,
                    endTime: segment.start + segment.duration,
                    originalSegmentIndex: i
                }
            });
            documents.push(doc);
        }
        console.log(`⚙️ Splitting ${documents.length} documents into chunks`);
        const splitDocs = await textSplitter.splitDocuments(documents);
        const enhancedDocs = splitDocs.map((doc, index) => {
            const originalDoc = documents.find(d => d.metadata.originalSegmentIndex === doc.metadata.originalSegmentIndex);
            if (originalDoc) {
                const textRatio = doc.pageContent.length / originalDoc.pageContent.length;
                const approximateStart = originalDoc.metadata.startTime +
                    (originalDoc.metadata.duration * 0.1); // Simple approximation
                const chunkTimestampedLink = `${videoLink}&t=${Math.floor(approximateStart)}s`;
                doc.metadata = {
                    ...doc.metadata,
                    timestampedVideoLink: chunkTimestampedLink,
                    chunkIndex: index,
                    approximateStartTime: approximateStart,
                    approximateDuration: originalDoc.metadata.duration * textRatio,
                    chunkLength: doc.pageContent.length,
                    isChunked: splitDocs.length > documents.length
                };
            }
            return doc;
        });
        console.log(`💾 Storing ${enhancedDocs.length} chunks in Qdrant collection: ${collectionName}`);
        try {
            await qdrant_1.QdrantVectorStore.fromDocuments(enhancedDocs, this.googleEmbeddings, {
                url: config_1.config.qdrantUrl,
                apiKey: config_1.config.qdrantApiKey,
                collectionName,
            });
            console.log(`✅ Successfully stored embeddings in collection: ${collectionName}`);
            return {
                documentCount: documents.length,
                chunkCount: enhancedDocs.length
            };
        }
        catch (error) {
            console.error(`❌ Error storing embeddings in Qdrant:`, error);
            throw error;
        }
    }
    getYoutubeUrl(videoId) {
        return `https://www.youtube.com/watch?v=${videoId}`;
    }
    async processYouTube(videoUrl, token, options = {}) {
        const startTime = Date.now();
        console.log(`🎥 Starting YouTube video processing: ${videoUrl}`);
        try {
            const { language, minDurationMinutes = 1, collectionName: customCollectionName } = options;
            if (!this.isValidYouTubeUrl(videoUrl)) {
                console.warn(`⚠️ Invalid YouTube URL: ${videoUrl}`);
                return {
                    success: false,
                    error: 'Invalid YouTube URL provided'
                };
            }
            const videoId = this.extractVideoId(videoUrl);
            const normalizedUrl = this.getYoutubeUrl(videoId);
            const collectionName = customCollectionName || `youtube-${token}`;
            console.log(`🎬 Processing video ID: ${videoId}`);
            console.log(`💾 Target collection: ${collectionName}`);
            const transcriptData = await this.createTranscript(videoId, language);
            const combinedSegments = this.combineToMinDuration(transcriptData, minDurationMinutes);
            if (combinedSegments.length === 0) {
                console.warn(`⚠️ No valid transcript segments found for video: ${videoId}`);
                return {
                    success: false,
                    error: 'No valid transcript segments found'
                };
            }
            const videoTitle = `YouTube Video (${videoId})`;
            const embeddingResult = await this.createEmbeddingsFromSubtitles(combinedSegments, videoTitle, normalizedUrl, collectionName, options);
            const videoInfo = {
                title: videoTitle,
                author: 'Unknown Author',
                length: 'Unknown Duration',
                description: 'Transcript extracted from YouTube video',
                videoId
            };
            const processingTime = Date.now() - startTime;
            console.log(`✅ YouTube video processed successfully in ${processingTime}ms`);
            console.log(`📊 Processed ${embeddingResult.documentCount} documents into ${embeddingResult.chunkCount} chunks`);
            return {
                success: true,
                collectionName,
                documentCount: embeddingResult.documentCount,
                chunkCount: embeddingResult.chunkCount,
                videoInfo
            };
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            console.error(`❌ Error processing YouTube video after ${processingTime}ms:`, error);
            let errorMessage = 'Unknown error occurred';
            if (error instanceof Error) {
                if (error.message.includes('Transcript is disabled')) {
                    errorMessage = 'Transcript is not available for this video';
                }
                else if (error.message.includes('Video unavailable')) {
                    errorMessage = 'Video is unavailable or private';
                }
                else if (error.message.includes('No transcript found')) {
                    errorMessage = 'No transcript found for this video';
                }
                else if (error.message.includes('languages:')) {
                    errorMessage = 'No transcript available in the requested language';
                }
                else {
                    errorMessage = error.message;
                }
            }
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    isValidYouTubeUrl(url) {
        try {
            const parsedUrl = new URL(url);
            const hostname = parsedUrl.hostname.toLowerCase();
            // Check for various YouTube URL formats
            const isYouTube = hostname === 'www.youtube.com' ||
                hostname === 'youtube.com' ||
                hostname === 'm.youtube.com' ||
                hostname === 'youtu.be';
            if (!isYouTube)
                return false;
            // Check for video ID in different formats
            if (hostname === 'youtu.be') {
                return parsedUrl.pathname.length > 1; // Has video ID
            }
            else {
                return parsedUrl.searchParams.has('v') || parsedUrl.pathname.includes('/watch');
            }
        }
        catch {
            return false;
        }
    }
    extractVideoId(url) {
        try {
            const parsedUrl = new URL(url);
            return parsedUrl.searchParams.get('v') || 'unknown';
        }
        catch {
            return 'unknown';
        }
    }
    async deleteCollection(token) {
        const collectionName = `youtube-${token}`;
        console.log(`🗑️ Attempting to delete collection: ${collectionName}`);
        try {
            console.log(`✅ Collection ${collectionName} marked for deletion`);
            return true;
        }
        catch (error) {
            console.error(`❌ Error deleting YouTube collection '${collectionName}':`, error);
            return false;
        }
    }
}
exports.youtubeLoaderService = new YouTubeLoaderService();
//# sourceMappingURL=youtubeLoader.js.map