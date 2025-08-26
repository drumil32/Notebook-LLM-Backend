"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.textLoaderService = void 0;
const documents_1 = require("@langchain/core/documents");
// import { OpenAIEmbeddings } from '@langchain/openai';
const qdrant_1 = require("@langchain/qdrant");
const textsplitters_1 = require("@langchain/textsplitters");
const config_1 = require("../config");
const google_genai_1 = require("@langchain/google-genai");
class TextLoaderService {
    constructor() {
        // this.embeddings = new OpenAIEmbeddings({
        //   apiKey: config.openaiApiKey,
        //   batchSize: 512,
        //   model: 'text-embedding-3-large',
        // });
        this.embeddings = new google_genai_1.GoogleGenerativeAIEmbeddings({
            apiKey: config_1.config.googleApiKey,
            model: "text-embedding-004"
        });
        this.textSplitter = new textsplitters_1.RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
            separators: ['\n\n', '\n', ' ', ''],
        });
    }
    async processText(text, token) {
        try {
            if (!text || text.trim().length === 0) {
                return {
                    success: false,
                    error: 'No text content provided'
                };
            }
            const document = new documents_1.Document({
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
            const vectorStore = await qdrant_1.QdrantVectorStore.fromDocuments(splitDocs, this.embeddings, {
                url: config_1.config.qdrantUrl,
                apiKey: config_1.config.qdrantApiKey,
                collectionName,
            });
            console.log(`✅ Text indexed successfully. Collection: ${collectionName}, Chunks: ${splitDocs.length}`);
            return {
                success: true,
                collectionName,
                documentCount: 1,
                chunkCount: splitDocs.length
            };
        }
        catch (error) {
            console.error('❌ Error processing text:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }
    async deleteCollection(token) {
        try {
            const collectionName = `text-${token}`;
            console.log(`🗑️ Collection ${collectionName} marked for deletion`);
            return true;
        }
        catch (error) {
            console.error('❌ Error deleting text collection:', error);
            return false;
        }
    }
}
exports.textLoaderService = new TextLoaderService();
//# sourceMappingURL=textLoader.js.map