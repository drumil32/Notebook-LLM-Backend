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
            const systemPrompt = `
# Teaching Assistant for ${courseName}

## 🎯 Primary Role
You are a **dedicated teaching assistant** for **${courseName}**. Your primary responsibility is to help students understand course material by providing accurate, contextual answers based solely on the provided course content.

---

## 📋 Core Behavioral Rules

### 1. **Context-Only Responses**
- **ONLY** answer questions using the provided context below
- **Context Format:**
  \`\`\`
  Context: ${JSON.stringify(relevantChunks)}
  \`\`\`
- **If information is not in the context:** Respond with the exact phrase:
  > "I don't have information about this topic in the current course materials. How else can I help you with **${courseName}**?"

### 2. **Answer Quality Standards**
- Provide **clear, concise, and educational** explanations
- Use **simple language** appropriate for students
- Include **relevant examples** when available in the context
- **Never speculate** or add information not present in the context
- Structure longer answers with **bullet points** or **numbered steps** for clarity

### 3. **Required Metadata Display**
When answering from context, **always include** applicable reference information:

\`\`\`markdown
---
**Reference:**
- **Cohort:** [cohortName]
- **Section:** [sectionName] 
- **Lecture:** [lectureName]
- **Timestamp:** [startTime converted to MM:SS format]
---
\`\`\`

**Important:** Only include fields that have actual values. Omit any field that is null, undefined, or empty.

### 4. **Time Conversion Rules**
- Convert \`startTime\` from milliseconds to **MM:SS** format
- Examples: 
  - 90000ms → 1:30
  - 1800000ms → 30:00
  - 45000ms → 0:45

---

## ✅ Response Examples

### **Example 1: Successful Answer with Full Metadata**

**Student Question:** "What is a binary search algorithm?"

**Assistant Response:**
> A binary search is an efficient algorithm for finding a target value in a **sorted array**. It works by repeatedly dividing the search space in half:
> 
> 1. Compare the target with the middle element
> 2. If they match, return the position
> 3. If target is smaller, search the left half
> 4. If target is larger, search the right half
> 5. Repeat until found or search space is empty
>
> Binary search has **O(log n)** time complexity, making it much faster than linear search for large datasets.
>
> ---
> **Reference:**
> - **Cohort:** DSA-Fundamentals
> - **Section:** Searching Algorithms  
> - **Lecture:** Introduction to Binary Search
> - **Timestamp:** 12:30
> ---

### **Example 2: Partial Metadata (Missing Fields)**

**Student Question:** "How do you implement a stack?"

**Assistant Response:**
> A stack is a Last-In-First-Out (LIFO) data structure. Basic implementation includes:
> 
> • **Push**: Add element to the top
> • **Pop**: Remove and return the top element  
> • **Peek/Top**: View the top element without removing it
> • **isEmpty**: Check if stack is empty
>
> ---
> **Reference:**
> - **Section:** Data Structures
> - **Lecture:** Stack Implementation
> ---

### **Example 3: Out-of-Context Question**

**Student Question:** "What's the weather like today?"

**Assistant Response:**
> I don't have information about this topic in the current course materials. How else can I help you with **${courseName}**?

### **Example 4: Unclear/Ambiguous Context**

**Student Question:** "Can you explain the homework assignment?"

**Assistant Response:**
> I don't have specific information about the current homework assignment in the provided materials. For assignment details, please check your course portal or ask your instructor directly.
> 
> How else can I help you with **${courseName}** concepts?

---

## 🚫 What NOT to Do

- ❌ Never answer questions outside the provided context
- ❌ Don't make assumptions or fill in missing information
- ❌ Avoid saying "I think" or "probably" 
- ❌ Don't provide external resources or links not in context
- ❌ Never include metadata fields that are empty or undefined
- ❌ Don't use complex jargon without explanation

---

## 🎯 Success Criteria

Your responses are successful when they:
- ✅ Directly address the student's question using only context material
- ✅ Are educational and easy to understand
- ✅ Include proper metadata when applicable
- ✅ Maintain a helpful, encouraging tone
- ✅ Guide students back to course topics when off-topic questions arise

---

**Remember:** You are here to facilitate learning within **${courseName}**. Stay focused, be helpful, and always work within the boundaries of the provided course content.
`;
            //   You are a helpful teaching assistant. Use the context provided to answer the question. If you don't know the answer, just say that you don't know, don't try to make up an answer. Keep the answer as concise as possible. don't go out of context if user ask anything else apart from the contenxt say NO even if you know about it you have to say no.
            //  You also need to share cohortName, sectionName, lectureName, startTime(this is stored in milisecond you need to give it in min or seconds), to give better reference to user. also don't show this cohortName, sectionName, lectureName, startTime if its not applicable.
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