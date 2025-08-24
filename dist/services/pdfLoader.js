"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pdfLoaderService = void 0;
const pdf_1 = require("@langchain/community/document_loaders/web/pdf");
// import { OpenAIEmbeddings } from '@langchain/openai';
const qdrant_1 = require("@langchain/qdrant");
const config_1 = require("../config");
const google_genai_1 = require("@langchain/google-genai");
class PDFLoaderService {
    ;
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
    }
    async processPDF(buffer, token) {
        try {
            if (!buffer || buffer.length === 0) {
                return {
                    success: false,
                    error: 'Invalid PDF buffer provided'
                };
            }
            const blob = new Blob([buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)], {
                type: 'application/pdf'
            });
            const loader = new pdf_1.WebPDFLoader(blob, {
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
            await qdrant_1.QdrantVectorStore.fromDocuments(docs, this.embeddings, {
                url: config_1.config.qdrantUrl,
                apiKey: config_1.config.qdrantApiKey,
                collectionName,
            });
            console.log(`✅ PDF indexed successfully. Collection: ${collectionName}, Documents: ${docs.length}`);
            return {
                success: true,
                collectionName,
                // chunkCount: vectorStore.chunkCount,
                documentCount: docs.length
            };
        }
        catch (error) {
            console.error('❌ Error processing PDF:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }
    //   Will see if needed NOT USED FOR NOW
    async deleteCollection(token) {
        try {
            const collectionName = `pdf-${token}`;
            // Note: Add collection deletion logic here if needed
            console.log(`🗑️ Collection ${collectionName} marked for deletion`);
            return true;
        }
        catch (error) {
            console.error('❌ Error deleting collection:', error);
            return false;
        }
    }
}
exports.pdfLoaderService = new PDFLoaderService();
//# sourceMappingURL=pdfLoader.js.map