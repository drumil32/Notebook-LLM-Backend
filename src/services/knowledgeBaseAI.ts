import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { OpenAI } from 'openai';
import { KnowledgeBaseData } from "./knowledgeBase";
import { config } from "../config";
import { QdrantVectorStore } from "@langchain/qdrant";

export interface AIResponse {
  content: string;
  sources: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

class KnowledgeBaseAI {
  private readonly embeddings: GoogleGenerativeAIEmbeddings;
  private readonly openaiClient: OpenAI;

  private readonly systemPrompts = {
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

  constructor() {
    // this.embeddings = new OpenAIEmbeddings({
    //   apiKey: config.openaiApiKey,
    //   batchSize: 512,
    //   model: 'text-embedding-3-large',
    // });

    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: config.googleApiKey,
      model: "text-embedding-004"
    });

    this.openaiClient = new OpenAI({
      apiKey: config.openaiApiKey
    });
  }

  async processMessage(
    message: string,
    knowledgeBaseData: KnowledgeBaseData,
    chatHistory: ChatMessage[] = []
  ): Promise<string> {
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
        .map(result => (result as PromiseFulfilledResult<string | null>).value!)
        .filter(Boolean);

      if (validAnswers.length === 0) {
        return 'No relevant information found in the knowledge base for your query.';
      }

      if (validAnswers.length === 1) {
        return validAnswers[0];
      }

      return await this.combineAnswers(validAnswers, message, chatHistory);
    } catch (error) {
      console.error('Error processing message:', error);
      throw new Error('Failed to process your message. Please try again.');
    }
  }

  private async getAnswerFromSource(
    sourceInfo: NonNullable<KnowledgeBaseData['textInfo']>,
    userQuery: string,
    chatHistory: ChatMessage[],
    sourceType: 'text' | 'pdf' | 'website' | 'youtube'
  ): Promise<string | null> {
    try {
      if (!sourceInfo?.collectionName) {
        return null;
      }

      const vectorStore = await QdrantVectorStore.fromExistingCollection(
        this.embeddings,
        {
          url: config.qdrantUrl,
          apiKey: config.qdrantApiKey,
          collectionName: sourceInfo.collectionName,
        }
      );

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
    } catch (error) {
      console.error(`Error getting answer from ${sourceType} source:`, error);
      return null;
    }
  }

  private async combineAnswers(
    answers: string[],
    userQuery: string,
    chatHistory: ChatMessage[]
  ): Promise<string> {
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
    } catch (error) {
      console.error('Error combining answers:', error);
      // Fallback: return the first answer if combination fails
      return answers[0] || 'Error processing your request.';
    }
  }
}

export const knowledgeBaseAI = new KnowledgeBaseAI();