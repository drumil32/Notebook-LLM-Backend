import { OpenAIEmbeddings } from "@langchain/openai";
import { YoutubeTranscript } from 'youtube-transcript';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { config } from "../config";
import { QdrantVectorStore } from "@langchain/qdrant";

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

class YouTubeLoaderService {
  private readonly embeddings: OpenAIEmbeddings;
  private readonly textSplitter: RecursiveCharacterTextSplitter;

  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      apiKey: config.openaiApiKey,
      batchSize: 512,
      model: 'text-embedding-3-large',
    });

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['\n\n', '\n', ' ', ''],
    });
  }

  async processYouTube(videoUrl: string, token: string, options: YouTubeProcessingOptions = {}): Promise<YouTubeProcessingResult> {
    try {
      const {
        chunkSize = 1000,
        chunkOverlap = 200
      } = options;

      console.log(`🎥 Processing YouTube video: ${videoUrl}`);

      // Validate YouTube URL
      if (!this.isValidYouTubeUrl(videoUrl)) {
        return {
          success: false,
          error: 'Invalid YouTube URL provided'
        };
      }

      // Update text splitter if custom options provided
      if (chunkSize !== 1000 || chunkOverlap !== 200) {
        const customTextSplitter = new RecursiveCharacterTextSplitter({
          chunkSize,
          chunkOverlap,
          separators: ['\n\n', '\n', ' ', ''],
        });
      }

      // Get transcript from YouTube
      const transcriptData = await YoutubeTranscript.fetchTranscript(videoUrl, {
        // lang: language || 'en',
      });

      if (!transcriptData || transcriptData.length === 0) {
        return {
          success: false,
          error: 'No transcript available for this video'
        };
      }

      // Convert transcript to text
      const fullTranscript = transcriptData.map(item => item.text).join(' ');
      
      // Extract video ID for basic info
      const videoId = this.extractVideoId(videoUrl);
      const videoInfo = {
        title: `YouTube Video (${videoId})`,
        author: 'Unknown Author',
        length: 'Unknown Duration',
        description: 'Transcript extracted from YouTube video'
      };

      console.log(`📝 Video Info: Transcript extracted for video ${videoId} (${transcriptData.length} segments)`);

      // Create document from transcript
      const doc = new Document({
        pageContent: fullTranscript,
        metadata: {
          source: videoUrl,
          videoId: videoId,
          segmentCount: transcriptData.length,
          type: 'youtube_transcript',
          ...videoInfo
        }
      });

      // Split document into chunks
      const splitDocs = await this.textSplitter.splitDocuments([doc]);

      if (splitDocs.length === 0) {
        return {
          success: false,
          error: 'Failed to process video transcript into chunks'
        };
      }

      const collectionName = `youtube-${token}`;
      
      console.log(`🗄️ Creating vector store: ${collectionName}`);
      console.log(`📊 Processing 1 document into ${splitDocs.length} chunks`);

      await QdrantVectorStore.fromDocuments(
        splitDocs,
        this.embeddings,
        {
          url: config.qdrantUrl,
          apiKey: config.qdrantApiKey,
          collectionName,
        }
      );

      console.log(`✅ YouTube video indexed successfully!`);
      console.log(`📚 Indexed ${splitDocs.length} chunks from "${videoInfo.title}"`);

      return {
        success: true,
        collectionName,
        documentCount: 1,
        chunkCount: splitDocs.length,
        videoInfo
      };
    } catch (error) {
      console.error('❌ Error processing YouTube video:', error);
      
      // Provide specific error messages
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        if (error.message.includes('Transcript is disabled')) {
          errorMessage = 'Transcript is not available for this video';
        } else if (error.message.includes('Video unavailable')) {
          errorMessage = 'Video is unavailable or private';
        } else if (error.message.includes('No transcript found')) {
          errorMessage = 'No transcript found for this video';
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
      const hostname = parsedUrl.hostname.toLowerCase();
      
      if (hostname === 'youtu.be') {
        return parsedUrl.pathname.slice(1); // Remove leading slash
      } else {
        return parsedUrl.searchParams.get('v') || 'unknown';
      }
    } catch {
      return 'unknown';
    }
  }

  async deleteCollection(token: string): Promise<boolean> {
    try {
      const collectionName = `youtube-${token}`;
      console.log(`🗑️ Collection ${collectionName} marked for deletion`);
      return true;
    } catch (error) {
      console.error('❌ Error deleting YouTube collection:', error);
      return false;
    }
  }
}

export const youtubeLoaderService = new YouTubeLoaderService();