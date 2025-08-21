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

      // Process all inputs in parallel
      const processingTasks = [];

      // Setup file processing task
      if (input.file) {
        knowledgeBaseData.fileInfo = {
          filename: input.file.originalname,
          size: input.file.size,
          mimetype: input.file.mimetype
        };

        if (input.file.mimetype === 'application/pdf') {
          processingTasks.push({
            type: 'file',
            task: pdfLoaderService.processPDF(input.file.buffer, token)
          });
        }
      }

      // Setup text processing task
      if (input.text) {
        console.log(`📝 Processing text input (${input.text.length} characters)`);
        processingTasks.push({
          type: 'text',
          task: textLoaderService.processText(input.text, token)
        });
      }

      // Setup link processing task
      if (input.link) {
        console.log(`🔗 Processing link: ${input.link}`);
        const webOptions: WebProcessingOptions = {
          crawlDepth: 'site',
          maxPages: 10,
          chunkSize: 1000,
          chunkOverlap: 200
        };
        processingTasks.push({
          type: 'link',
          task: webLoaderService.processWebsite(input.link, token, webOptions),
          options: webOptions
        });
      }

      // Execute all processing tasks in parallel
      if (processingTasks.length > 0) {
        console.log(`🚀 Starting parallel processing of ${processingTasks.length} tasks`);

        const results = await Promise.allSettled(
          processingTasks.map(task => task.task)
        );

        // Process results and handle errors
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const taskType = processingTasks[i].type;

          if (result.status === 'rejected') {
            console.error(`❌ ${taskType} processing failed:`, result.reason);
            return {
              success: false,
              errors: [{ field: taskType, message: `Failed to process ${taskType}` }]
            };
          }

          const taskResult = result.value;
          if (!taskResult.success) {
            return {
              success: false,
              errors: [{ field: taskType, message: taskResult.error || `Failed to process ${taskType}` }]
            };
          }

          // Update knowledgeBaseData based on task type
          switch (taskType) {
            case 'file':
              if (knowledgeBaseData.fileInfo) {
                knowledgeBaseData.fileInfo.collectionName = taskResult.collectionName;
                knowledgeBaseData.fileInfo.documentCount = taskResult.documentCount;
              }
              break;

            case 'text':
              knowledgeBaseData.textInfo = {
                collectionName: taskResult.collectionName,
                documentCount: taskResult.documentCount,
                chunkCount: taskResult.chunkCount
              };
              break;

            case 'link':
              const linkTask = processingTasks[i] as any;
              knowledgeBaseData.linkInfo = {
                url: input.link!,
                collectionName: taskResult.collectionName,
                documentCount: taskResult.documentCount,
                chunkCount: taskResult.chunkCount,
                crawlDepth: linkTask.options.crawlDepth
              };
              break;
          }
        }

        console.log(`✅ Parallel processing completed successfully`);
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