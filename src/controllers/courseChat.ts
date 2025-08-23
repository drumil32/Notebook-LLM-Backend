import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { chatService } from '../services/chatService';
import { redisService } from '../services/redis';
import { QdrantVectorStore } from '@langchain/qdrant';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { config } from '../config';
import { Agent, run } from '@openai/agents';

export class CourseChatController {
  private readonly CHAT_HISTORY_TTL = 3600; // 5 minutes
  private readonly embeddings: GoogleGenerativeAIEmbeddings;
  constructor() {
    console.log('ran constructor');
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

      const { message } = req.body;
      let { token } = req.body;

      if (!message) {
        res.status(400).json({
          success: false,
          message: 'Both message and token are required'
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
          collectionName: 'chai-or-code',
        }
      );

      const retriever = vectorStore.asRetriever({
        k: 3,
      });

      const relevantChunks = await retriever.invoke(message);
      const stringToken = await redisService.get(token);
      const lastConversationId = stringToken ? JSON.parse(stringToken) : null;

      const systemPrompt = `You are a helpful teaching assistant. Use the context provided to answer the question. If you don't know the answer, just say that you don't know, don't try to make up an answer. Keep the answer as concise as possible. You also need to share cohortName, sectionName, lectureName, startTime(this is stored in milisecond you need to give it in min or seconds), to give better reference to user. also don't show this cohortName, sectionName, lectureName, startTime if its not applicable.
        Context:
        ${JSON.stringify(relevantChunks)}
        `;
      const agent = new Agent({
        name: 'Assistant',
        instructions: systemPrompt,
      });

      const result = await run(agent, message, lastConversationId ? { previousResponseId: lastConversationId } : {});
      await redisService.set(token, JSON.stringify(result.lastResponseId), this.CHAT_HISTORY_TTL);

      res.status(200).json({
        success: true,
        message: result.finalOutput,
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