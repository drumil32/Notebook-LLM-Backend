"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webLoaderService = void 0;
const puppeteer_1 = require("@langchain/community/document_loaders/web/puppeteer");
const qdrant_1 = require("@langchain/qdrant");
const textsplitters_1 = require("@langchain/textsplitters");
const puppeteer_2 = __importDefault(require("puppeteer"));
const config_1 = require("../config");
const google_genai_1 = require("@langchain/google-genai");
class WebLoaderService {
    constructor() {
        // this.embeddings = new OpenAIEmbeddings({
        //   apiKey: config.openaiApiKey,
        //   batchSize: 512,
        //   model: 'text-embedding-3-large',
        // });
        this.embeddings = new google_genai_1.GoogleGenerativeAIEmbeddings({
            apiKey: config_1.config.googleApiKey,
            model: "text-embedding-004"
        });
        this.textSplitter = new textsplitters_1.RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
            separators: ['\n\n', '\n', ' ', ''],
        });
    }
    async discoverLinks(baseUrl, maxPages = 50) {
        const browser = await puppeteer_2.default.launch({ headless: true });
        const page = await browser.newPage();
        const visitedUrls = new Set();
        const urlsToVisit = [baseUrl];
        const discoveredUrls = [];
        console.log(`🔍 Starting to discover links from ${baseUrl}...`);
        try {
            while (urlsToVisit.length > 0 && discoveredUrls.length < maxPages) {
                const currentUrl = urlsToVisit.shift();
                if (!currentUrl || visitedUrls.has(currentUrl))
                    continue;
                visitedUrls.add(currentUrl);
                try {
                    console.log(`🔗 Discovering links from: ${currentUrl}`);
                    await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    const links = await page.evaluate((baseUrl) => {
                        const anchors = Array.from(document.querySelectorAll('a[href]'));
                        return anchors
                            .map(anchor => anchor.href)
                            .filter(href => {
                            try {
                                const url = new URL(href);
                                return url.hostname === new URL(baseUrl).hostname;
                            }
                            catch {
                                return false;
                            }
                        })
                            .filter(href => {
                            return !href.match(/\.(pdf|jpg|jpeg|png|gif|zip|exe|dmg)$/i);
                        });
                    }, baseUrl);
                    discoveredUrls.push(currentUrl);
                    links.forEach(link => {
                        if (!visitedUrls.has(link) && !urlsToVisit.includes(link)) {
                            urlsToVisit.push(link);
                        }
                    });
                }
                catch (error) {
                    console.error(`❌ Error processing ${currentUrl}:`, error instanceof Error ? error.message : 'Unknown error');
                }
            }
        }
        finally {
            await browser.close();
        }
        console.log(`✅ Discovered ${discoveredUrls.length} URLs`);
        return discoveredUrls;
    }
    async loadMultipleUrls(urls) {
        const allDocs = [];
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            console.log(`📄 Loading ${i + 1}/${urls.length}: ${url}`);
            try {
                const loader = new puppeteer_1.PuppeteerWebBaseLoader(url, {
                    launchOptions: {
                        headless: true,
                    },
                    gotoOptions: {
                        waitUntil: 'domcontentloaded',
                        timeout: 30000,
                    },
                    evaluate: async (page, browser) => {
                        const result = await page.evaluate(() => {
                            const elementsToRemove = ['script', 'style', 'nav', 'footer', 'header'];
                            elementsToRemove.forEach(tag => {
                                const elements = document.querySelectorAll(tag);
                                elements.forEach((el) => el.remove());
                            });
                            const mainContent = document.querySelector('main') ||
                                document.querySelector('[role="main"]') ||
                                document.querySelector('.content') ||
                                document.body;
                            return mainContent ? mainContent.innerText : document.body.innerText;
                        });
                        return result;
                    },
                });
                const docs = await loader.load();
                if (docs && docs.length > 0 && docs[0].pageContent.trim()) {
                    docs[0].metadata = {
                        ...docs[0].metadata,
                        source: url,
                        crawled_at: new Date().toISOString()
                    };
                    allDocs.push(...docs);
                    console.log(`✅ Loaded: ${url} (${docs[0].pageContent.length} chars)`);
                }
                else {
                    console.log(`⚠️ Skipped: ${url} (no content)`);
                }
            }
            catch (error) {
                console.error(`❌ Failed to load ${url}:`, error instanceof Error ? error.message : 'Unknown error');
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        return allDocs;
    }
    async processWebsite(url, token, options = {}) {
        try {
            const { maxPages = 20, chunkSize = 1000, chunkOverlap = 200, crawlDepth = 'single' } = options;
            // Update text splitter if custom chunk size provided
            if (chunkSize !== 1000 || chunkOverlap !== 200) {
                this.textSplitter = new textsplitters_1.RecursiveCharacterTextSplitter({
                    chunkSize,
                    chunkOverlap,
                    separators: ['\n\n', '\n', ' ', ''],
                });
            }
            let urls;
            if (crawlDepth === 'single') {
                urls = [url];
                console.log(`📄 Processing single URL: ${url}`);
            }
            else {
                console.log(`🔍 Discovering website pages from: ${url}`);
                urls = await this.discoverLinks(url, maxPages);
            }
            console.log(`📄 Loading content from ${urls.length} page(s)...`);
            const allDocs = await this.loadMultipleUrls(urls);
            if (allDocs.length === 0) {
                return {
                    success: false,
                    error: 'No content could be extracted from the provided URL(s)'
                };
            }
            console.log(`✂️ Splitting ${allDocs.length} documents into chunks...`);
            const splitDocs = await this.textSplitter.splitDocuments(allDocs);
            console.log(`📊 Processing Statistics:`);
            console.log(`  • Pages Crawled: ${allDocs.length}`);
            console.log(`  • Chunks Created: ${splitDocs.length}`);
            console.log(`  • Average Chunks per Page: ${(splitDocs.length / allDocs.length).toFixed(1)}`);
            const collectionName = `web-${token}`;
            console.log(`🗄️ Creating vector store: ${collectionName}`);
            const vectorStore = await qdrant_1.QdrantVectorStore.fromDocuments(splitDocs, this.embeddings, {
                url: config_1.config.qdrantUrl,
                apiKey: config_1.config.qdrantApiKey,
                collectionName,
            });
            console.log(`✅ Web content indexed successfully!`);
            console.log(`📚 Indexed ${splitDocs.length} chunks from ${allDocs.length} pages`);
            return {
                success: true,
                collectionName,
                documentCount: allDocs.length,
                chunkCount: splitDocs.length
            };
        }
        catch (error) {
            console.error('❌ Error processing website:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }
    async deleteCollection(token) {
        try {
            const collectionName = `web-${token}`;
            console.log(`🗑️ Collection ${collectionName} marked for deletion`);
            return true;
        }
        catch (error) {
            console.error('❌ Error deleting web collection:', error);
            return false;
        }
    }
}
exports.webLoaderService = new WebLoaderService();
//# sourceMappingURL=webLoader.js.map