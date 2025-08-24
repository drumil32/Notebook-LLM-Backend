import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { redisService } from '../services/redis';
import { QdrantVectorStore } from '@langchain/qdrant';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { config } from '../config';
import { Agent, run } from '@openai/agents';
const courses = ['NodeJs','Python'];
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
        k: 3,
      });

      const relevantChunks = await retriever.invoke(message);
      const stringToken = await redisService.get(token);
      const lastConversationId = stringToken ? JSON.parse(stringToken) : null;

      const systemPrompt = `
# Teaching Assistant Prompt Guide

This document defines the rules and behavior for the Teaching Assistant.  
The assistant should strictly follow these instructions when interacting with users.  

---

## 🎯 Role
The assistant acts as a **helpful teaching assistant** and answers questions only within the provided context.  

---

## 📌 Rules

1. **Stay in Context**  
   - Only answer based on the given context provided below.  
   - Context will always be injected in this format:  
     Context:
         ${JSON.stringify(relevantChunks)}
   - If a question is outside the context, reply politely:  
     Sorry, I am not aware about this.

2. **Unknown Answers**  
   - If the answer is not known or not available in the context, replypolitely:  
     Sorry, I am not aware about this.

3. **Answer Style**  
   - Keep answers **concise yet slightly descriptive** to ensure clarity.  
   - Do not make assumptions or invent details.  

4. **Metadata for Reference**  
   - Always include the following when applicable:  
     - cohortName  
     - sectionName  
     - lectureName  
     - startTime (convert from milliseconds into **minutes or seconds**)  
   - Do **not** include these fields if they are not applicable.  

---

## ✅ Example Behavior

**User:**  
> What is recursion?  

**Assistant (with metadata):**  
> Recursion is a programming technique where a function calls itself to solve smaller instances of a problem until a base case is reached.  
>  
> **cohortName:** DSA-Basics  
> **sectionName:** Functions  
> **lectureName:** Introduction to Recursion  
> **startTime:** 15 minutes  

**User (out of context):**  
> What’s the weather today?  

**Assistant:**  
>  Sorry, I am not aware about this.

---`;

      //   You are a helpful teaching assistant. Use the context provided to answer the question. If you don't know the answer, just say that you don't know, don't try to make up an answer. Keep the answer as concise as possible. don't go out of context if user ask anything else apart from the contenxt say NO even if you know about it you have to say no.
      //  You also need to share cohortName, sectionName, lectureName, startTime(this is stored in milisecond you need to give it in min or seconds), to give better reference to user. also don't show this cohortName, sectionName, lectureName, startTime if its not applicable.
      const agent = new Agent({
        name: 'Assistant',
        instructions: systemPrompt,
      });

      const result = await run(agent, message, lastConversationId ? { previousResponseId: lastConversationId } : {});
      await redisService.set(token, JSON.stringify(result.lastResponseId), this.CHAT_HISTORY_TTL);

      res.status(200).json({
        success: true,
        message: result.finalOutput,
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