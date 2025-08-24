"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.knowledgeBaseAI = void 0;
const google_genai_1 = require("@langchain/google-genai");
const openai_1 = require("openai");
const config_1 = require("../config");
const qdrant_1 = require("@langchain/qdrant");
class KnowledgeBaseAI {
    constructor() {
        // this.embeddings = new OpenAIEmbeddings({
        //   apiKey: config.openaiApiKey,
        //   batchSize: 512,
        //   model: 'text-embedding-3-large',
        // });
        this.systemPrompts = {
            pdf: `You are an AI assistant who provides answers based on the available context from PDF documents. 
You must stay strictly within the provided context. When answering user queries, always mention the source of the information.
Be concise and accurate in your responses.`,
            text: `You are an AI assistant who provides answers based on the available context from text information. 
You must stay strictly within the provided context. When answering user queries, always mention the source of the information.
Be concise and accurate in your responses.`,
            website: `You are an AI assistant who provides answers based on the available context from website information. 
You must stay strictly within the provided context. When answering user queries, always mention the source of the information.
Be concise and accurate in your responses.`,
            youtube: `You are an AI assistant who provides answers based on the available context from YouTube video transcripts. 
You must stay strictly within the provided context. When answering user queries, always mention the video source and timestamp when possible.
Be concise and accurate in your responses. Note that this information comes from a YouTube video and share the timestamped video link from the metadata (found under "timestampedVideoLink")`
        };
        this.embeddings = new google_genai_1.GoogleGenerativeAIEmbeddings({
            apiKey: config_1.config.googleApiKey,
            model: "text-embedding-004"
        });
        this.openaiClient = new openai_1.OpenAI({
            apiKey: config_1.config.openaiApiKey
        });
    }
    async processMessage(message, knowledgeBaseData, chatHistory = []) {
        try {
            const [textAnswer, fileAnswer, linkAnswer, youtubeAnswer] = await Promise.allSettled([
                knowledgeBaseData.textInfo
                    ? this.getAnswerFromSource(knowledgeBaseData.textInfo, message, chatHistory, 'text')
                    : Promise.resolve(null),
                knowledgeBaseData.fileInfo
                    ? this.getAnswerFromSource(knowledgeBaseData.fileInfo, message, chatHistory, 'pdf')
                    : Promise.resolve(null),
                knowledgeBaseData.linkInfo
                    ? this.getAnswerFromSource(knowledgeBaseData.linkInfo, message, chatHistory, 'website')
                    : Promise.resolve(null),
                knowledgeBaseData.youtubeInfo
                    ? this.getAnswerFromSource(knowledgeBaseData.youtubeInfo, message, chatHistory, 'youtube')
                    : Promise.resolve(null),
            ]);
            const validAnswers = [textAnswer, fileAnswer, linkAnswer, youtubeAnswer]
                .filter(result => result.status === 'fulfilled' && result.value)
                .map(result => result.value)
                .filter(Boolean);
            if (validAnswers.length === 0) {
                return 'No relevant information found in the knowledge base for your query.';
            }
            if (validAnswers.length === 1) {
                return validAnswers[0];
            }
            return await this.combineAnswers(validAnswers, message, chatHistory);
        }
        catch (error) {
            console.error('Error processing message:', error);
            throw new Error('Failed to process your message. Please try again.');
        }
    }
    async getAnswerFromSource(sourceInfo, userQuery, chatHistory, sourceType) {
        try {
            if (!sourceInfo?.collectionName) {
                return null;
            }
            const vectorStore = await qdrant_1.QdrantVectorStore.fromExistingCollection(this.embeddings, {
                url: config_1.config.qdrantUrl,
                apiKey: config_1.config.qdrantApiKey,
                collectionName: sourceInfo.collectionName,
            });
            const retriever = vectorStore.asRetriever({
                k: 3,
            });
            const relevantChunks = await retriever.invoke(userQuery);
            if (!relevantChunks.length) {
                return null;
            }
            // const contextText = relevantChunks
            //   .map(chunk => chunk.pageContent)
            //   .join('\n\n');
            const historyText = chatHistory
                .slice(-6) // Last 6 messages for context
                .map(msg => `${msg.role}: ${msg.content}`)
                .join('\n');
            const systemPrompt = `${this.systemPrompts[sourceType]}
        
Context from ${sourceType}:
${JSON.stringify(relevantChunks)}

${historyText ? `Previous conversation:\n${historyText}` : ''}

Respond based only on the provided context. If the context doesn't contain relevant information, say so.`;
            const response = await this.openaiClient.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userQuery }
                ],
                temperature: 0.1,
                max_tokens: 1000,
            });
            const content = response.choices[0]?.message?.content;
            console.log(`📊 Answer from ${sourceType} source:`, {
                collectionName: sourceInfo.collectionName,
                chunksFound: relevantChunks.length,
                answerLength: content?.length,
                answer: content
            });
            return content;
        }
        catch (error) {
            console.error(`Error getting answer from ${sourceType} source:`, error);
            return null;
        }
    }
    async combineAnswers(answers, userQuery, chatHistory) {
        try {
            const historyText = chatHistory
                .slice(-6) // Last 6 messages for context
                .map(msg => `${msg.role}: ${msg.content}`)
                .join('\n');
            const systemPrompt = `You are an AI assistant that combines multiple relevant answers into a single coherent response.

User Query: ${userQuery}

${historyText ? `Previous conversation:\n${historyText}\n` : ''}

Multiple answers found:
${answers.map((answer, index) => `Source ${index + 1}:\n${answer}`).join('\n\n---\n\n')}

Combine these answers into a single, well-structured response. Remove redundancy while preserving all important information and sources mentioned.`;
            const response = await this.openaiClient.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'system', content: systemPrompt }],
                temperature: 0.1,
                max_tokens: 1500,
            });
            const content = response.choices[0]?.message?.content;
            console.log(`📊 final answer:`, {
                answerLength: content?.length,
                answer: content
            });
            return content ?? 'Unable to combine answers.';
        }
        catch (error) {
            console.error('Error combining answers:', error);
            // Fallback: return the first answer if combination fails
            return answers[0] || 'Error processing your request.';
        }
    }
}
exports.knowledgeBaseAI = new KnowledgeBaseAI();
//# sourceMappingURL=knowledgeBaseAI.js.map