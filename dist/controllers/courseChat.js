"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.courseChatController = exports.CourseChatController = void 0;
const uuid_1 = require("uuid");
const redis_1 = require("../services/redis");
const qdrant_1 = require("@langchain/qdrant");
const google_genai_1 = require("@langchain/google-genai");
const config_1 = require("../config");
const agents_1 = require("@openai/agents");
const courses = ['NodeJs', 'Python'];
class CourseChatController {
    constructor() {
        this.CHAT_HISTORY_TTL = 3600; // 5 minutes
        console.log('ran constructor');
        this.embeddings = new google_genai_1.GoogleGenerativeAIEmbeddings({
            apiKey: config_1.config.googleApiKey,
            model: "text-embedding-004"
        });
    }
    async chat(req, res) {
        try {
            if (!req.body) {
                res.status(400).json({
                    success: false,
                    message: 'Request body is required'
                });
                return;
            }
            const { message, courseName } = req.body;
            let { token } = req.body;
            if (!message || !courseName || !courses.includes(courseName)) {
                res.status(400).json({
                    success: false,
                    message: 'Both message and courseName are required'
                });
                return;
            }
            if (!token) {
                token = (0, uuid_1.v4)();
            }
            const vectorStore = await qdrant_1.QdrantVectorStore.fromExistingCollection(this.embeddings, {
                url: config_1.config.qdrantUrl,
                apiKey: config_1.config.qdrantApiKey,
                collectionName: `chai-or-code-${courseName.toLowerCase()}`,
            });
            const retriever = vectorStore.asRetriever({
                k: 3,
            });
            const relevantChunks = await retriever.invoke(message);
            const stringToken = await redis_1.redisService.get(token);
            const lastConversationId = stringToken ? JSON.parse(stringToken) : null;
            const systemPrompt = `You are a helpful teaching assistant. Use the context provided to answer the question. If you don't know the answer, just say that you don't know, don't try to make up an answer. Keep the answer as concise as possible. You also need to share cohortName, sectionName, lectureName, startTime(this is stored in milisecond you need to give it in min or seconds), to give better reference to user. also don't show this cohortName, sectionName, lectureName, startTime if its not applicable.
        Context:
        ${JSON.stringify(relevantChunks)}
        `;
            const agent = new agents_1.Agent({
                name: 'Assistant',
                instructions: systemPrompt,
            });
            const result = await (0, agents_1.run)(agent, message, lastConversationId ? { previousResponseId: lastConversationId } : {});
            await redis_1.redisService.set(token, JSON.stringify(result.lastResponseId), this.CHAT_HISTORY_TTL);
            res.status(200).json({
                success: true,
                message: result.finalOutput,
                courseName,
                token,
            });
        }
        catch (error) {
            console.error('Error in chat controller:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
}
exports.CourseChatController = CourseChatController;
exports.courseChatController = new CourseChatController();
//# sourceMappingURL=courseChat.js.map