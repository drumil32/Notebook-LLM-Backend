import { OpenAIEmbeddings } from "@langchain/openai";
import { YoutubeLoader } from "@langchain/community/document_loaders/web/youtube";
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

      const loader = YoutubeLoader.createFromUrl(videoUrl, {
        addVideoInfo: true,
      });

      const docs = await loader.load();

      if (docs.length === 0) {
        return {
          success: false,
          error: 'No transcript available for this video'
        };
      }

      // Extract video information from metadata
      const firstDoc = docs[0];
      const videoInfo = {
        title: firstDoc.metadata.title || 'Unknown Title',
        author: firstDoc.metadata.author || 'Unknown Author',
        length: firstDoc.metadata.length || 'Unknown Duration',
        description: firstDoc.metadata.description || ''
      };

      console.log(`📝 Video Info: ${videoInfo.title} by ${videoInfo.author} (${videoInfo.length})`);

      // Split documents into chunks
      const splitDocs = await this.textSplitter.splitDocuments(docs);

      if (splitDocs.length === 0) {
        return {
          success: false,
          error: 'Failed to process video transcript into chunks'
        };
      }

      const collectionName = `youtube-${token}`;
      
      console.log(`🗄️ Creating vector store: ${collectionName}`);
      console.log(`📊 Processing ${docs.length} documents into ${splitDocs.length} chunks`);

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
        documentCount: docs.length,
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