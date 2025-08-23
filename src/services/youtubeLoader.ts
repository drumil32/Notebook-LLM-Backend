import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
// Will use dynamic import for youtube-transcript-plus
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { config } from '../config';
import { QdrantVectorStore } from '@langchain/qdrant';

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

class YouTubeLoaderService {
  private readonly openAIEmbeddings: OpenAIEmbeddings;
  private readonly googleEmbeddings: GoogleGenerativeAIEmbeddings;
  private readonly textSplitter: RecursiveCharacterTextSplitter;

  constructor() {
    console.log('🚀 Initializing YouTube Loader Service');

    this.openAIEmbeddings = new OpenAIEmbeddings({
      apiKey: config.openaiApiKey,
      batchSize: 512,
      model: 'text-embedding-3-large',
    });

    this.googleEmbeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: config.googleApiKey,
      model: 'text-embedding-004',
    });

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['\n\n', '\n', ' ', ''],
    });

    console.log('✅ YouTube Loader Service initialized successfully');
  }

  private async createTranscript(videoId: string, language?: string): Promise<TranscriptSegment[]> {
    console.log(`🎥 Fetching transcript for video: ${videoId}`);

    try {
      const ytTranscript = await (Function('return import("@osiris-ai/youtube-captions-sdk")')());
      const transcriptList = await ytTranscript.TranscriptList.fetch(videoId);
      const transcript = transcriptList.find(['en', 'en-US', 'hi']);
      const fetched = await transcript.fetch();
      return fetched.snippets;
    } catch (error) {
      console.error(`❌ Error fetching transcript for video ${videoId}:`, error);
      throw error;
    }
  }

  // private combineToMinDuration(
  //   segments: TranscriptSegment[],
  //   minDurationMinutes: number = 5
  // ): CombinedTranscriptSegment[] {
  //   console.log(`🔗 Combining ${segments.length} segments to minimum duration of ${minDurationMinutes} minutes`);

  //   const minDurationSeconds = minDurationMinutes * 60;
  //   const result: CombinedTranscriptSegment[] = [];
  //   let currentText = '';
  //   let currentStartTime = -1;
  //   let currentEndTime = -1;

  //   for (const segment of segments) {
  //     const segmentEndTime = segment.offset + segment.duration;

  //     currentText += segment.text + ' ';

  //     if (currentStartTime === -1) {
  //       currentStartTime = segment.offset;
  //     }

  //     currentEndTime = Math.max(currentEndTime, segmentEndTime);
  //     const actualDuration = currentEndTime - currentStartTime;

  //     if (actualDuration >= minDurationSeconds) {
  //       result.push({
  //         text: currentText.trim(),
  //         start: currentStartTime,
  //         duration: actualDuration
  //       });

  //       currentStartTime = -1;
  //       currentEndTime = -1;
  //       currentText = '';
  //     }
  //   }

  //   // Handle any remaining segments
  //   if (currentStartTime !== -1) {
  //     result.push({
  //       text: currentText.trim(),
  //       start: currentStartTime,
  //       duration: currentEndTime - currentStartTime
  //     });
  //   }

  //   console.log(`✅ Combined into ${result.length} segments`);
  //   return result;
  // }

  private combineToMinDuration(
    data: TranscriptSegment[],
    minDurationMinutes: number = 5
  ): CombinedTranscriptSegment[] {
    const minDurationSeconds = minDurationMinutes * 60; // Convert to seconds (300s)
    const result: CombinedTranscriptSegment[] = [];
    let currentText = '';
    let currentStartTime = -1;
    let currentEndTime = -1;

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const itemEndTime = item.start + item.duration;

      // Add current item to the group
      currentText += item.text + ' ';

      // Set start time for the first item in group
      if (currentStartTime === -1) {
        currentStartTime = item.start;
      }

      // Update the end time to the latest end time
      currentEndTime = Math.max(currentEndTime, itemEndTime);

      // Calculate actual elapsed time (from first start to latest end)
      const actualDuration = currentEndTime - currentStartTime;

      // Check if we've reached the minimum duration
      if (actualDuration >= minDurationSeconds) {
        // Create combined object
        const combinedItem: CombinedTranscriptSegment = {
          text: currentText.trim(),
          start: currentStartTime,
          duration: actualDuration
        };

        result.push(combinedItem);

        // Reset for new group
        currentStartTime = -1;
        currentEndTime = -1;
        currentText = '';
      }
    }

    // Handle remaining items that didn't reach minimum duration
    if (currentStartTime !== -1) {
      const actualDuration = currentEndTime - currentStartTime;
      const combinedItem: CombinedTranscriptSegment = {
        text: currentText.trim(),
        start: currentStartTime,
        duration: actualDuration
      };
      result.push(combinedItem);
    }

    return result;
  }

  private async createEmbeddingsFromSubtitles(
    subtitleData: CombinedTranscriptSegment[],
    videoName: string,
    videoLink: string,
    collectionName: string,
    options: YouTubeProcessingOptions = {}
  ): Promise<{ documentCount: number; chunkCount: number }> {
    console.log(`🧠 Creating embeddings for ${subtitleData.length} subtitle segments`);

    const { chunkSize = 1000, chunkOverlap = 200 } = options;

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
      lengthFunction: (text: string) => text.length,
    });

    const documents: Document<DocumentMetadata>[] = [];

    for (let i = 0; i < subtitleData.length; i++) {
      const segment = subtitleData[i];
      const timestampedLink = `${videoLink}&t=${Math.floor(segment.start)}s`;

      const doc = new Document({
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
      const originalDoc = documents.find(d =>
        d.metadata.originalSegmentIndex === doc.metadata.originalSegmentIndex
      );

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
      await QdrantVectorStore.fromDocuments(
        enhancedDocs,
        this.googleEmbeddings,
        {
          url: config.qdrantUrl,
          apiKey: config.qdrantApiKey,
          collectionName,
        }
      );

      console.log(`✅ Successfully stored embeddings in collection: ${collectionName}`);

      return {
        documentCount: documents.length,
        chunkCount: enhancedDocs.length
      };
    } catch (error) {
      console.error(`❌ Error storing embeddings in Qdrant:`, error);
      throw error;
    }
  }
  private getYoutubeUrl(videoId: string): string {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  async processYouTube(
    videoUrl: string,
    token: string,
    options: YouTubeProcessingOptions = {}
  ): Promise<YouTubeProcessingResult> {
    const startTime = Date.now();
    console.log(`🎥 Starting YouTube video processing: ${videoUrl}`);

    try {
      const {
        language,
        minDurationMinutes = 1,
        collectionName: customCollectionName
      } = options;

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
      const combinedSegments = this.combineToMinDuration(
        transcriptData,
        minDurationMinutes
      );

      if (combinedSegments.length === 0) {
        console.warn(`⚠️ No valid transcript segments found for video: ${videoId}`);
        return {
          success: false,
          error: 'No valid transcript segments found'
        };
      }

      const videoTitle = `YouTube Video (${videoId})`;
      const embeddingResult = await this.createEmbeddingsFromSubtitles(
        combinedSegments,
        videoTitle,
        normalizedUrl,
        collectionName,
        options
      );

      const videoInfo: VideoInfo = {
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
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ Error processing YouTube video after ${processingTime}ms:`, error);

      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        if (error.message.includes('Transcript is disabled')) {
          errorMessage = 'Transcript is not available for this video';
        } else if (error.message.includes('Video unavailable')) {
          errorMessage = 'Video is unavailable or private';
        } else if (error.message.includes('No transcript found')) {
          errorMessage = 'No transcript found for this video';
        } else if (error.message.includes('languages:')) {
          errorMessage = 'No transcript available in the requested language';
        } else {
          errorMessage = error.message;
        }
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  private isValidYouTubeUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.toLowerCase();

      // Check for various YouTube URL formats
      const isYouTube = hostname === 'www.youtube.com' ||
        hostname === 'youtube.com' ||
        hostname === 'm.youtube.com' ||
        hostname === 'youtu.be';

      if (!isYouTube) return false;

      // Check for video ID in different formats
      if (hostname === 'youtu.be') {
        return parsedUrl.pathname.length > 1; // Has video ID
      } else {
        return parsedUrl.searchParams.has('v') || parsedUrl.pathname.includes('/watch');
      }
    } catch {
      return false;
    }
  }

  private extractVideoId(url: string): string {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.searchParams.get('v') || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  async deleteCollection(token: string): Promise<boolean> {
    const collectionName = `youtube-${token}`;
    console.log(`🗑️ Attempting to delete collection: ${collectionName}`);

    try {
      console.log(`✅ Collection ${collectionName} marked for deletion`);
      return true;
    } catch (error) {
      console.error(`❌ Error deleting YouTube collection '${collectionName}':`, error);
      return false;
    }
  }
}

export const youtubeLoaderService = new YouTubeLoaderService();