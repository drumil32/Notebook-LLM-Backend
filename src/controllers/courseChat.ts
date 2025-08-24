import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { redisService } from '../services/redis';
import { QdrantVectorStore } from '@langchain/qdrant';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { config } from '../config';
import { Agent, getGlobalTraceProvider, run } from '@openai/agents';
import { personaSystemPrompt, systemPrompt } from './systemPrompt';
import { RECOMMENDED_PROMPT_PREFIX } from '@openai/agents-core/extensions';

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

      const retriever = vectorStore.asRetriever({
        k: 5,
      });

      const relevantChunks = await retriever.invoke(message);
      const stringToken = await redisService.get(token);
      const lastConversationId = stringToken ? JSON.parse(stringToken) : null;
  

      const personaAgent = new Agent({
        name: 'Persona Message Agent',
        instructions: personaSystemPrompt,
      });

      const agent = Agent.create({
        name: 'Assistant',
        instructions: systemPrompt(courseName,relevantChunks),
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