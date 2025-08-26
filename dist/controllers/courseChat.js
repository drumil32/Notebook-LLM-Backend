"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.courseChatController = exports.CourseChatController = void 0;
const uuid_1 = require("uuid");
const redis_1 = require("../services/redis");
const qdrant_1 = require("@langchain/qdrant");
const google_genai_1 = require("@langchain/google-genai");
const config_1 = require("../config");
const agents_1 = require("@openai/agents");
const systemPrompt_1 = require("./systemPrompt");
const ensemble_1 = require("langchain/retrievers/ensemble");
const multi_query_1 = require("langchain/retrievers/multi_query");
const openai_1 = require("@langchain/openai");
const courses = ['NodeJs', 'Python'];
class CourseChatController {
    constructor() {
        this.CHAT_HISTORY_TTL = 3600; // 5 minutes
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
            ////////////// approach-1
            // const retriever = vectorStore.asRetriever({
            //   k: 5,
            // });
            // const relevantChunks = await retriever.invoke(message);
            ////////////// approach-2
            // Semantic retriever
            // const vectorRetriever = vectorStore.asRetriever({ k: 5 });
            // // Keyword retriever (simple)
            // const keywordRetriever = vectorStore.asRetriever({ k: 5, searchType: "mmr" });
            // // Hybrid: combine both
            // const retriever = new EnsembleRetriever({
            //   retrievers: [vectorRetriever, keywordRetriever],
            //   weights: [0.7, 0.3], // semantic has higher weight
            // });
            // const relevantChunks = await retriever.invoke(message);
            ////////////// approach-3
            // 1) your existing retrievers (dense + “keyword-ish”)
            const vectorRetriever = vectorStore.asRetriever({
                k: 5,
                searchType: "mmr", // diversity helps before multi-query merges
                searchKwargs: { lambda: 0.5 },
            });
            const keywordRetriever = vectorStore.asRetriever({
                k: 5,
                // (If you later add a true BM25 retriever, swap this with that)
            });
            // 2) ensemble (hybrid) retriever — same as you had
            const baseHybridRetriever = new ensemble_1.EnsembleRetriever({
                retrievers: [vectorRetriever, keywordRetriever],
                weights: [0.7, 0.3],
            });
            // 3) multi-query wrapper: LLM generates multiple query variants
            const llm = new openai_1.ChatOpenAI({
                model: "gpt-4o-mini", // pick your model
                temperature: 0, // set >0 (e.g., 0.2–0.4) for more variety
                apiKey: config_1.config.openaiApiKey,
            });
            const multiRetriever = multi_query_1.MultiQueryRetriever.fromLLM({
                retriever: baseHybridRetriever, // wrap your hybrid retriever
                llm,
                queryCount: 4, // 3–6 is a good starting range
                verbose: false, // set true to log generated queries
            });
            // 4) use it exactly like before
            const relevantChunks = await multiRetriever.invoke(message);
            const uniqueRelevantChunks = Array.from(new Map(relevantChunks.map(chunk => [chunk.id, chunk])).values());
            console.log(uniqueRelevantChunks);
            const stringToken = await redis_1.redisService.get(token);
            const lastConversationId = stringToken ? JSON.parse(stringToken) : null;
            const personaAgent = new agents_1.Agent({
                name: 'Persona Message Agent',
                instructions: systemPrompt_1.personaSystemPrompt,
            });
            const agent = agents_1.Agent.create({
                name: 'Assistant',
                instructions: (0, systemPrompt_1.systemPrompt)(courseName, uniqueRelevantChunks),
            });
            const result = await (0, agents_1.run)(agent, message, lastConversationId ? { previousResponseId: lastConversationId } : {});
            await redis_1.redisService.set(token, JSON.stringify(result.lastResponseId), this.CHAT_HISTORY_TTL);
            let personaResult;
            if (typeof result.finalOutput === 'string') {
                personaResult = await (0, agents_1.run)(personaAgent, result.finalOutput);
            }
            res.status(200).json({
                success: true,
                message: personaResult?.finalOutput ?? result.finalOutput,
                agentMessage: result.finalOutput,
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