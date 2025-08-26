# Notebook LLM Backend - AI-Powered Course Chatbot

## Introduction

Have you ever thought about how Udemy's chatbot works? If you've noticed Udemy's chat feature where you can communicate with a bot about courses - asking which topics are covered in specific videos and getting short explanations - this project is inspired by that concept.

This is a Node.js-based AI chatbot system trained on VTT (Video Text Track) files from Node.js and Python courses. Using advanced RAG (Retrieval Augmented Generation) concepts with query rewriting and hybrid query search, the system provides intelligent course-related assistance with Hitesh Sir's persona to make interactions more engaging! 😃😃

## ✨ Key Features

- **🎥 Multi-format Content Processing**: Supports YouTube videos, PDFs, web content, and text files
- **🧠 RAG Implementation**: Advanced retrieval-augmented generation with query rewriting
- **🔍 Hybrid Search**: Combines semantic and keyword-based search for better accuracy  
- **📊 Vector Database**: Qdrant DB for storing and retrieving vector embeddings
- **⚡ Session Management**: Redis-powered session handling with TTL
- **🎭 Personalized AI**: Features Hitesh Sir's persona for engaging conversations
- **🚀 Rate Limiting**: Built-in API rate limiting and request tracking
- **🔒 CORS Protection**: Origin validation and security middleware

## 🏗️ Architecture

The system follows a modular architecture with clear separation of concerns:

```
src/
├── controllers/        # Request handlers
│   ├── chat.ts        # General chat functionality
│   ├── courseChat.ts  # Course-specific chat
│   └── knowledgeBase.ts # Knowledge base management
├── services/          # Business logic
│   ├── chatService.ts       # Chat session management
│   ├── knowledgeBaseAI.ts   # AI processing engine
│   ├── knowledgeBase.ts     # Knowledge base operations
│   ├── redis.ts            # Redis connection & operations
│   └── loaders/            # Content loading services
│       ├── pdfLoader.ts
│       ├── textLoader.ts
│       ├── webLoader.ts
│       └── youtubeLoader.ts
├── middleware/        # Express middleware
│   ├── apiTracker.ts       # API usage tracking
│   ├── rateLimiter.ts      # Rate limiting
│   └── origin-validation.ts # CORS validation
└── routes/           # API routes
    ├── chat.ts
    ├── courseChat.ts
    └── knowledgeBase.ts
```

## 🔧 Technology Stack

### Core Technologies
- **Node.js** with **TypeScript** - Runtime and type safety
- **Express.js** - Web framework
- **Redis** - Session management and caching
- **Qdrant** - Vector database for embeddings

### AI & ML Libraries
- **LangChain** - AI framework and text processing
- **@langchain/google-genai** - Google's Generative AI integration
- **@langchain/openai** - OpenAI integration
- **@langchain/qdrant** - Qdrant vector store integration
- **@langchain/textsplitters** - Text chunking and splitting

### Content Processing
- **youtube-transcript** - YouTube video transcript extraction
- **pdf-parse** - PDF document processing
- **puppeteer** - Web scraping capabilities
- **multer** - File upload handling

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- Redis server
- Qdrant vector database
- OpenAI API key or Google AI API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd backend
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Configure the following variables:
- `OPENAI_API_KEY` or `GOOGLE_AI_API_KEY`
- `REDIS_URL`
- `QDRANT_URL`
- `QDRANT_API_KEY`
- `FRONTEND_URL_1`, `FRONTEND_URL_2`
- `PORT`

4. Start the development server:
```bash
pnpm dev
```

5. Build for production:
```bash
pnpm build
pnpm start
```

## 📡 API Endpoints

### Knowledge Base Management
- `POST /knowledge-base/upload` - Upload and process documents
- `GET /knowledge-base/status/:token` - Check processing status
- `DELETE /knowledge-base/:token` - Delete knowledge base

### Chat Interface
- `POST /chat` - General chat with knowledge base
- `POST /course-chat` - Course-specific chat
- `GET /chat/history/:token` - Get chat history
- `DELETE /chat/history/:token` - Clear chat history

## 🎯 How It Works

1. **Content Ingestion**: Upload various content types (YouTube videos, PDFs, text files)
2. **Processing**: Content is chunked, processed, and converted to vector embeddings
3. **Storage**: Embeddings are stored in Qdrant vector database
4. **Query Processing**: User queries are rewritten and enhanced for better retrieval
5. **Hybrid Search**: System performs both semantic and keyword searches
6. **Response Generation**: RAG pipeline generates contextual responses
7. **Session Management**: Redis maintains conversation history and context

## 🔄 RAG Implementation Details

### Query Rewriting
- Analyzes user intent and context
- Reformulates queries for better semantic matching
- Maintains conversation continuity

### Hybrid Search Strategy
- **Semantic Search**: Vector similarity using embeddings
- **Keyword Search**: Traditional text matching
- **Score Fusion**: Combines both approaches for optimal results

### Context Management
- Maintains conversation history
- Preserves session state with Redis TTL
- Implements smart context windowing

## 🛡️ Security Features

- **Origin Validation**: Restricts API access to authorized domains
- **Rate Limiting**: Prevents API abuse with configurable limits
- **Session Security**: Token-based session management
- **Request Validation**: Input sanitization and validation
- **CORS Configuration**: Secure cross-origin resource sharing

## 📊 Monitoring & Analytics

- **API Usage Tracking**: Monitors endpoint usage with 7-day expiry
- **Request Logging**: Comprehensive request/response logging
- **Session Metrics**: Tracks active sessions and usage patterns
- **Error Handling**: Detailed error logging and user-friendly messages

## 🎭 Hitesh Sir Persona

The chatbot incorporates Hitesh Sir's teaching style and personality:
- Encouraging and motivational responses
- Clear explanations with practical examples
- Focus on real-world applications
- Engaging and friendly communication style

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Commit your changes: `git commit -m 'Add feature'`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

## 📝 License

This project is licensed under the ISC License.

## 🙏 Acknowledgments

- Inspired by Udemy's course chatbot functionality
- Built with modern AI/ML technologies
- Thanks to the open-source community for the amazing tools and libraries

---

*Built with ❤️ using Node.js, TypeScript, and AI/ML technologies*