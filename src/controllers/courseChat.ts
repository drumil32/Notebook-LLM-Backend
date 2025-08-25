import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { redisService } from '../services/redis';
import { QdrantVectorStore } from '@langchain/qdrant';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { config } from '../config';
import { Agent, getGlobalTraceProvider, run } from '@openai/agents';
import { personaSystemPrompt, systemPrompt } from './systemPrompt';
import { EnsembleRetriever } from "langchain/retrievers/ensemble";
import { MultiQueryRetriever } from "langchain/retrievers/multi_query";
import { ChatOpenAI } from "@langchain/openai";


const courses = ['NodeJs', 'Python'];
export class CourseChatController {
  private readonly CHAT_HISTORY_TTL = 3600; // 5 minutes
  private readonly embeddings: GoogleGenerativeAIEmbeddings;
  constructor() {
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: config.googleApiKey,
      model: "text-embedding-004"
    });
  }

  async chat(req: Request, res: Response): Promise<void> {
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
        token = uuidv4();
      }

      const vectorStore = await QdrantVectorStore.fromExistingCollection(
        this.embeddings,
        {
          url: config.qdrantUrl,
          apiKey: config.qdrantApiKey,
          collectionName: `chai-or-code-${courseName.toLowerCase()}`,
        }
      );

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
        searchType: "mmr",             // diversity helps before multi-query merges
        searchKwargs: { lambda: 0.5 },
      });

      const keywordRetriever = vectorStore.asRetriever({
        k: 5,
        // (If you later add a true BM25 retriever, swap this with that)
      });

      // 2) ensemble (hybrid) retriever — same as you had
      const baseHybridRetriever = new EnsembleRetriever({
        retrievers: [vectorRetriever, keywordRetriever],
        weights: [0.7, 0.3],
      });

      // 3) multi-query wrapper: LLM generates multiple query variants
      const llm = new ChatOpenAI({
        model: "gpt-4o-mini",          // pick your model
        temperature: 0,                 // set >0 (e.g., 0.2–0.4) for more variety
        apiKey: config.openaiApiKey,
      });

      const multiRetriever = MultiQueryRetriever.fromLLM({
        retriever: baseHybridRetriever, // wrap your hybrid retriever
        llm,
        queryCount: 4,                  // 3–6 is a good starting range
        verbose: false,                 // set true to log generated queries
      });

      // 4) use it exactly like before
      const relevantChunks = await multiRetriever.invoke(message);
      const uniqueRelevantChunks = Array.from(new Map(relevantChunks.map(chunk => [chunk.id, chunk])).values())
      console.log(uniqueRelevantChunks);

      const stringToken = await redisService.get(token);
      const lastConversationId = stringToken ? JSON.parse(stringToken) : null;

      const personaAgent = new Agent({
        name: 'Persona Message Agent',
        instructions: personaSystemPrompt,
      });

      const agent = Agent.create({
        name: 'Assistant',
        instructions: systemPrompt(courseName, uniqueRelevantChunks),
      });
      const result = await run(agent, message, lastConversationId ? { previousResponseId: lastConversationId } : {});
      await redisService.set(token, JSON.stringify(result.lastResponseId), this.CHAT_HISTORY_TTL);

      let personaResult;
      if (typeof result.finalOutput === 'string') {
        personaResult = await run(personaAgent, result.finalOutput);
      }

      res.status(200).json({
        success: true,
        message: personaResult?.finalOutput ?? result.finalOutput,
        agentMessage: result.finalOutput,
        courseName,
        token,
      });
    } catch (error) {
      console.error('Error in chat controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export const courseChatController = new CourseChatController();