import { WebPDFLoader } from '@langchain/community/document_loaders/web/pdf';
// import { OpenAIEmbeddings } from '@langchain/openai';
import { QdrantVectorStore } from '@langchain/qdrant';
import { config } from '../config';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';

export interface PDFProcessingResult {
  success: boolean;
  collectionName?: string;
  documentCount?: number;
  chunkCount?: number;
  error?: string;
}

class PDFLoaderService {
  private readonly embeddings: GoogleGenerativeAIEmbeddings;;

  constructor() {
    // this.embeddings = new OpenAIEmbeddings({
    //   apiKey: config.openaiApiKey,
    //   batchSize: 512,
    //   model: 'text-embedding-3-large',
    // });
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: config.googleApiKey,
      model: "text-embedding-004"
    });
  }

  async processPDF(buffer: Buffer, token: string): Promise<PDFProcessingResult> {
    try {
      if (!buffer || buffer.length === 0) {
        return {
          success: false,
          error: 'Invalid PDF buffer provided'
        };
      }

      const blob = new Blob([buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer], {
        type: 'application/pdf'
      });

      const loader = new WebPDFLoader(blob, {
        splitPages: true,
        parsedItemSeparator: ' '
      });

      const docs = await loader.load();

      if (docs.length === 0) {
        return {
          success: false,
          error: 'No content extracted from PDF'
        };
      }

      const collectionName = `pdf-${token}`;
      await QdrantVectorStore.fromDocuments(
        docs,
        this.embeddings,
        {
          url: config.qdrantUrl,
          apiKey: config.qdrantApiKey,
          collectionName,
        }
      );

      console.log(`✅ PDF indexed successfully. Collection: ${collectionName}, Documents: ${docs.length}`);

      return {
        success: true,
        collectionName,
        // chunkCount: vectorStore.chunkCount,
        documentCount: docs.length
      };
    } catch (error) {
      console.error('❌ Error processing PDF:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  //   Will see if needed NOT USED FOR NOW
  async deleteCollection(token: string): Promise<boolean> {
    try {
      const collectionName = `pdf-${token}`;
      // Note: Add collection deletion logic here if needed
      console.log(`🗑️ Collection ${collectionName} marked for deletion`);
      return true;
    } catch (error) {
      console.error('❌ Error deleting collection:', error);
      return false;
    }
  }
}

export const pdfLoaderService = new PDFLoaderService();