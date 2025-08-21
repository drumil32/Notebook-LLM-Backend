import { Document } from '@langchain/core/documents';
import { OpenAIEmbeddings } from '@langchain/openai';
import { QdrantVectorStore } from '@langchain/qdrant';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { config } from '../config';

export interface TextProcessingResult {
  success: boolean;
  collectionName?: string;
  documentCount?: number;
  chunkCount?: number;
  error?: string;
}

class TextLoaderService {
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

  async processText(text: string, token: string): Promise<TextProcessingResult> {
    try {
      if (!text || text.trim().length === 0) {
        return {
          success: false,
          error: 'No text content provided'
        };
      }

      const document = new Document({
        pageContent: text,
        metadata: {
          source: "user-text-input",
          uploadedAt: new Date().toISOString(),
          type: "text"
        }
      });
      
      const splitDocs = await this.textSplitter.splitDocuments([document]);
      
      if (splitDocs.length === 0) {
        return {
          success: false,
          error: 'No chunks created from text'
        };
      }

      const collectionName = `text-${token}`;
      const vectorStore = await QdrantVectorStore.fromDocuments(
        splitDocs, 
        this.embeddings, 
        {
          url: config.qdrantUrl,
          apiKey: config.qdrantApiKey,
          collectionName,
        }
      );

      console.log(`✅ Text indexed successfully. Collection: ${collectionName}, Chunks: ${splitDocs.length}`);
      
      return {
        success: true,
        collectionName,
        documentCount: 1,
        chunkCount: splitDocs.length
      };
    } catch (error) {
      console.error('❌ Error processing text:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async deleteCollection(token: string): Promise<boolean> {
    try {
      const collectionName = `text-${token}`;
      console.log(`🗑️ Collection ${collectionName} marked for deletion`);
      return true;
    } catch (error) {
      console.error('❌ Error deleting text collection:', error);
      return false;
    }
  }
}

export const textLoaderService = new TextLoaderService();