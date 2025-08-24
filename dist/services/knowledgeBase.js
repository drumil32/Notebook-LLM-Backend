"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.knowledgeBaseService = void 0;
const uuid_1 = require("uuid");
const redis_1 = require("./redis");
const pdfLoader_1 = require("./pdfLoader");
const webLoader_1 = require("./webLoader");
const textLoader_1 = require("./textLoader");
const youtubeLoader_1 = require("./youtubeLoader");
class KnowledgeBaseService {
    constructor() {
        this.TEXT_LIMIT = 10000;
        this.FILE_SIZE_LIMIT = 5 * 1024 * 1024; // 5MB
        this.ALLOWED_FILE_TYPES = ['application/pdf', 'text/csv', 'application/vnd.ms-excel'];
        this.REDIS_KEY_PREFIX = 'knowledge_base:';
        this.TTL_SECONDS = 3600; // 1 hour
    }
    async processKnowledgeBase(input) {
        const validationErrors = this.validateInput(input);
        if (validationErrors.length > 0) {
            return {
                success: false,
                errors: validationErrors
            };
        }
        try {
            const token = (0, uuid_1.v4)();
            const now = new Date();
            const expiresAt = new Date(now.getTime() + this.TTL_SECONDS * 1000);
            const knowledgeBaseData = {
                token,
                text: input.text,
                link: input.link,
                createdAt: now.toISOString(),
                expiresAt: expiresAt.toISOString()
            };
            // Add YouTube URL to data if provided
            if (input.youtubeUrl) {
                knowledgeBaseData.youtubeInfo = {
                    url: input.youtubeUrl
                };
            }
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
                        task: pdfLoader_1.pdfLoaderService.processPDF(input.file.buffer, token)
                    });
                }
            }
            // Setup text processing task
            if (input.text) {
                console.log(`📝 Processing text input (${input.text.length} characters)`);
                processingTasks.push({
                    type: 'text',
                    task: textLoader_1.textLoaderService.processText(input.text, token)
                });
            }
            // Setup link processing task
            if (input.link) {
                console.log(`🔗 Processing link: ${input.link}`);
                const webOptions = {
                    crawlDepth: 'site',
                    maxPages: 10,
                    chunkSize: 1000,
                    chunkOverlap: 200
                };
                processingTasks.push({
                    type: 'link',
                    task: webLoader_1.webLoaderService.processWebsite(input.link, token, webOptions),
                    options: webOptions
                });
            }
            // Setup YouTube processing task
            if (input.youtubeUrl) {
                console.log(`🎥 Processing YouTube video: ${input.youtubeUrl}`);
                const youtubeOptions = {
                    // language: 'en',
                    chunkSize: 1000,
                    chunkOverlap: 200
                };
                processingTasks.push({
                    type: 'youtube',
                    task: youtubeLoader_1.youtubeLoaderService.processYouTube(input.youtubeUrl, token, youtubeOptions),
                    options: youtubeOptions
                });
            }
            // Execute all processing tasks in parallel
            if (processingTasks.length > 0) {
                console.log(`🚀 Starting parallel processing of ${processingTasks.length} tasks`);
                const results = await Promise.allSettled(processingTasks.map(task => task.task));
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
                            const linkTask = processingTasks[i];
                            knowledgeBaseData.linkInfo = {
                                url: input.link,
                                collectionName: taskResult.collectionName,
                                documentCount: taskResult.documentCount,
                                chunkCount: taskResult.chunkCount,
                                crawlDepth: linkTask.options.crawlDepth
                            };
                            break;
                        case 'youtube':
                            if (knowledgeBaseData.youtubeInfo) {
                                const youtubeResult = taskResult;
                                knowledgeBaseData.youtubeInfo.collectionName = youtubeResult.collectionName;
                                knowledgeBaseData.youtubeInfo.documentCount = youtubeResult.documentCount;
                                knowledgeBaseData.youtubeInfo.chunkCount = youtubeResult.chunkCount;
                                knowledgeBaseData.youtubeInfo.videoInfo = youtubeResult.videoInfo;
                            }
                            break;
                    }
                }
                console.log(`✅ Parallel processing completed successfully`);
            }
            const redisKey = `${this.REDIS_KEY_PREFIX}${token}`;
            await redis_1.redisService.set(redisKey, JSON.stringify(knowledgeBaseData), this.TTL_SECONDS);
            console.log(`✅ Knowledge base created with token: ${token}`);
            return {
                success: true,
                token
            };
        }
        catch (error) {
            console.error('❌ Error processing knowledge base:', error);
            return {
                success: false,
                errors: [{ field: 'server', message: 'Internal server error' }]
            };
        }
    }
    validateInput(input) {
        const errors = [];
        if (!input.text && !input.file && !input.link && !input.youtubeUrl) {
            errors.push({
                field: 'general',
                message: 'At least one of text, file, link, or YouTube URL must be provided'
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
        if (input.youtubeUrl) {
            if (!this.isValidYouTubeUrl(input.youtubeUrl)) {
                errors.push({
                    field: 'youtubeUrl',
                    message: 'Invalid YouTube URL format'
                });
            }
        }
        return errors;
    }
    countWords(text) {
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }
    isValidUrl(url) {
        try {
            const parsedUrl = new URL(url);
            return ['http:', 'https:'].includes(parsedUrl.protocol);
        }
        catch {
            return false;
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
    async getKnowledgeBase(token) {
        try {
            const redisKey = `${this.REDIS_KEY_PREFIX}${token}`;
            const data = await redis_1.redisService.get(redisKey);
            if (!data) {
                return null;
            }
            const parsedData = JSON.parse(data);
            // Check if expired
            if (new Date() > new Date(parsedData.expiresAt)) {
                await this.deleteKnowledgeBase(token);
                return null;
            }
            return parsedData;
        }
        catch (error) {
            console.error('❌ Error retrieving knowledge base:', error);
            return null;
        }
    }
    //   Will see if needed NOT USED FOR NOW
    async deleteKnowledgeBase(token) {
        try {
            const redisKey = `${this.REDIS_KEY_PREFIX}${token}`;
            const data = await redis_1.redisService.get(redisKey);
            if (data) {
                const parsedData = JSON.parse(data);
                // Clean up collections if they exist
                if (parsedData.fileInfo?.collectionName) {
                    await pdfLoader_1.pdfLoaderService.deleteCollection(token);
                }
                if (parsedData.linkInfo?.collectionName) {
                    await webLoader_1.webLoaderService.deleteCollection(token);
                }
                if (parsedData.textInfo?.collectionName) {
                    await textLoader_1.textLoaderService.deleteCollection(token);
                }
                if (parsedData.youtubeInfo?.collectionName) {
                    await youtubeLoader_1.youtubeLoaderService.deleteCollection(token);
                }
            }
            await redis_1.redisService.del(redisKey);
            console.log(`🗑️ Knowledge base deleted: ${token}`);
            return true;
        }
        catch (error) {
            console.error('❌ Error deleting knowledge base:', error);
            return false;
        }
    }
    //   Will see if needed NOT USED FOR NOW
    async listKnowledgeBases() {
        try {
            const pattern = `${this.REDIS_KEY_PREFIX}*`;
            const keys = await redis_1.redisService.keys(pattern);
            return keys.map(key => key.replace(this.REDIS_KEY_PREFIX, ''));
        }
        catch (error) {
            console.error('❌ Error listing knowledge bases:', error);
            return [];
        }
    }
}
exports.knowledgeBaseService = new KnowledgeBaseService();
//# sourceMappingURL=knowledgeBase.js.map