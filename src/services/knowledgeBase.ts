import { v4 as uuidv4 } from 'uuid';
import { redisService } from './redis';
import { pdfLoaderService, PDFProcessingResult } from './pdfLoader';
import { webLoaderService, WebProcessingResult, WebProcessingOptions } from './webLoader';
import { textLoaderService, TextProcessingResult } from './textLoader';

export interface KnowledgeBaseInput {
  text?: string;
  file?: Express.Multer.File;
  link?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface KnowledgeBaseResponse {
  success: boolean;
  token?: string;
  errors?: ValidationError[];
}

export interface KnowledgeBaseData {
  token: string;
  text?: string;
  link?: string;
  fileInfo?: {
    filename: string;
    size: number;
    mimetype: string;
    collectionName?: string;
    documentCount?: number;
  };
  linkInfo?: {
    url: string;
    collectionName?: string;
    documentCount?: number;
    chunkCount?: number;
    crawlDepth?: 'single' | 'site';
  };
  textInfo?: {
    collectionName?: string;
    documentCount?: number;
    chunkCount?: number;
  };
  createdAt: string;
  expiresAt: string;
}

class KnowledgeBaseService {
  private readonly TEXT_LIMIT = 10000;
  private readonly FILE_SIZE_LIMIT = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_FILE_TYPES = ['application/pdf', 'text/csv', 'application/vnd.ms-excel'];
  private readonly REDIS_KEY_PREFIX = 'knowledge_base:';
  private readonly TTL_SECONDS = 3600; // 1 hour

  private static readonly MIME_TYPES: Record<string, string> = {
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'doc': 'application/msword',
    'txt': 'text/plain',
    'csv': 'text/csv',
    'json': 'application/json'
  };

  private getMimeType(fileType: string): string {
    return KnowledgeBaseService.MIME_TYPES[fileType.toLowerCase()] || 'application/octet-stream';
  }

  async processKnowledgeBase(input: KnowledgeBaseInput): Promise<KnowledgeBaseResponse> {
    const validationErrors = this.validateInput(input);

    if (validationErrors.length > 0) {
      return {
        success: false,
        errors: validationErrors
      };
    }

    try {
      const token = uuidv4();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.TTL_SECONDS * 1000);
      
      const knowledgeBaseData: KnowledgeBaseData = {
        token,
        text: input.text,
        link: input.link,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString()
      };

      // Process file if provided
      if (input.file) {
        knowledgeBaseData.fileInfo = {
          filename: input.file.originalname,
          size: input.file.size,
          mimetype: input.file.mimetype
        };

        // Process PDF files
        if (input.file.mimetype === 'application/pdf') {
          const pdfResult = await pdfLoaderService.processPDF(input.file.buffer, token);
          
          if (!pdfResult.success) {
            return {
              success: false,
              errors: [{ field: 'file', message: pdfResult.error || 'Failed to process PDF' }]
            };
          }

          knowledgeBaseData.fileInfo.collectionName = pdfResult.collectionName;
          knowledgeBaseData.fileInfo.documentCount = pdfResult.documentCount;
        }
      }

      // Process text if provided
      if (input.text) {
        try {
          console.log(`📝 Processing text input (${input.text.length} characters)`);
          
          const textResult = await textLoaderService.processText(input.text, token);
          
          if (!textResult.success) {
            return {
              success: false,
              errors: [{ field: 'text', message: textResult.error || 'Failed to process text' }]
            };
          }

          knowledgeBaseData.textInfo = {
            collectionName: textResult.collectionName,
            documentCount: textResult.documentCount,
            chunkCount: textResult.chunkCount
          };
        } catch (error) {
          console.error('❌ Error processing text:', error);
          return {
            success: false,
            errors: [{ field: 'text', message: 'Failed to process text content' }]
          };
        }
      }

      // Process link if provided
      if (input.link) {
        try {
          console.log(`🔗 Processing link: ${input.link}`);
          
          // Determine crawl depth based on URL pattern or user preference
          // For now, default to single page processing
          const webOptions: WebProcessingOptions = {
            crawlDepth: 'site',
            maxPages: 10,
            chunkSize: 1000,
            chunkOverlap: 200
          };

          const webResult = await webLoaderService.processWebsite(input.link, token, webOptions);
          
          if (!webResult.success) {
            return {
              success: false,
              errors: [{ field: 'link', message: webResult.error || 'Failed to process website' }]
            };
          }

          knowledgeBaseData.linkInfo = {
            url: input.link,
            collectionName: webResult.collectionName,
            documentCount: webResult.documentCount,
            chunkCount: webResult.chunkCount,
            crawlDepth: webOptions.crawlDepth
          };
        } catch (error) {
          console.error('❌ Error processing link:', error);
          return {
            success: false,
            errors: [{ field: 'link', message: 'Failed to process website content' }]
          };
        }
      }

      const redisKey = `${this.REDIS_KEY_PREFIX}${token}`;
      await redisService.set(redisKey, JSON.stringify(knowledgeBaseData), this.TTL_SECONDS);

      console.log(`✅ Knowledge base created with token: ${token}`);

      return {
        success: true,
        token
      };
    } catch (error) {
      console.error('❌ Error processing knowledge base:', error);
      return {
        success: false,
        errors: [{ field: 'server', message: 'Internal server error' }]
      };
    }
  }

  private validateInput(input: KnowledgeBaseInput): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!input.text && !input.file && !input.link) {
      errors.push({
        field: 'general',
        message: 'At least one of text, file, or link must be provided'
      });
      return errors;
    }

    if (input.text) {
      const wordCount = this.countWords(input.text);
      if (wordCount > this.TEXT_LIMIT) {
        errors.push({
          field: 'text',
          message: `Text exceeds the limit of ${this.TEXT_LIMIT} words. Current word count: ${wordCount}`
        });
      }
    }

    if (input.file) {
      if (input.file.size > this.FILE_SIZE_LIMIT) {
        errors.push({
          field: 'file',
          message: `File size exceeds the limit of 5MB. Current size: ${(input.file.size / (1024 * 1024)).toFixed(2)}MB`
        });
      }

      if (!this.ALLOWED_FILE_TYPES.includes(input.file.mimetype)) {
        errors.push({
          field: 'file',
          message: 'Only PDF and CSV files are allowed'
        });
      }
    }

    if (input.link) {
      if (!this.isValidUrl(input.link)) {
        errors.push({
          field: 'link',
          message: 'Invalid URL format'
        });
      }
    }

    return errors;
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch {
      return false;
    }
  }

  async getKnowledgeBase(token: string): Promise<KnowledgeBaseData | null> {
    try {
      const redisKey = `${this.REDIS_KEY_PREFIX}${token}`;
      const data = await redisService.get(redisKey);

      if (!data) {
        return null;
      }

      const parsedData = JSON.parse(data) as KnowledgeBaseData;
      
      // Check if expired
      if (new Date() > new Date(parsedData.expiresAt)) {
        await this.deleteKnowledgeBase(token);
        return null;
      }

      return parsedData;
    } catch (error) {
      console.error('❌ Error retrieving knowledge base:', error);
      return null;
    }
  }

  //   Will see if needed NOT USED FOR NOW
  async deleteKnowledgeBase(token: string): Promise<boolean> {
    try {
      const redisKey = `${this.REDIS_KEY_PREFIX}${token}`;
      const data = await redisService.get(redisKey);
      
      if (data) {
        const parsedData = JSON.parse(data) as KnowledgeBaseData;
        
        // Clean up collections if they exist
        if (parsedData.fileInfo?.collectionName) {
          await pdfLoaderService.deleteCollection(token);
        }
        if (parsedData.linkInfo?.collectionName) {
          await webLoaderService.deleteCollection(token);
        }
        if (parsedData.textInfo?.collectionName) {
          await textLoaderService.deleteCollection(token);
        }
      }
      
      await redisService.del(redisKey);
      console.log(`🗑️ Knowledge base deleted: ${token}`);
      return true;
    } catch (error) {
      console.error('❌ Error deleting knowledge base:', error);
      return false;
    }
  }

  //   Will see if needed NOT USED FOR NOW
  async listKnowledgeBases(): Promise<string[]> {
    try {
      const pattern = `${this.REDIS_KEY_PREFIX}*`;
      const keys = await redisService.keys(pattern);
      return keys.map(key => key.replace(this.REDIS_KEY_PREFIX, ''));
    } catch (error) {
      console.error('❌ Error listing knowledge bases:', error);
      return [];
    }
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();