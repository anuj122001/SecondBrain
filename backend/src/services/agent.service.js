const OpenAI = require('openai');
const { generateEmbedding } = require('./embeddings.service');
const { searchKnowledgeBase } = require('./vector.service');
const { hybridRerank } = require('./reranker.service');
const Document = require('../models/Document');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

const tools = [
  {
    type: "function",
    function: {
      name: "search_knowledge_base",
      description: "Search the user's uploaded documents for information relevant to the user's query.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to look for in the documents.",
          },
        },
        required: ["query"],
      },
    }
  }
];

/**
 * Rewrites a raw user query into a more precise, search-optimized version.
 * This improves vector similarity results by making the query more specific
 * and keyword-rich before it is converted into an embedding.
 * 
 * @param {string} rawQuery - The original user question
 * @returns {Promise<string>} The rewritten, search-optimized query
 */
const rewriteQuery = async (rawQuery) => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `You are a query rewriting assistant. Your job is to take the user's raw question and rewrite it into a more precise, search-optimized query that will perform better in a semantic vector search over a document knowledge base.

Rules:
- Output ONLY the rewritten query, nothing else.
- Expand abbreviations and acronyms.
- Add relevant synonyms or related terms.
- Make the query more specific and descriptive.
- Remove filler words and conversational language.
- Keep it concise (1-2 sentences max).

Examples:
- Raw: "what does it say about AI?" → Rewritten: "artificial intelligence concepts, machine learning applications, and AI capabilities discussed in the documents"
- Raw: "how to deploy?" → Rewritten: "deployment process, hosting steps, production setup, and deployment configuration instructions"
- Raw: "tell me about the budget" → Rewritten: "budget allocation, financial planning, cost breakdown, and expenditure details"`
        },
        { role: "user", content: rawQuery }
      ]
    });

    const rewrittenQuery = response.choices[0].message.content.trim();
    console.log(`✏️  Query rewritten: "${rawQuery}" → "${rewrittenQuery}"`);
    return rewrittenQuery;
  } catch (error) {
    console.warn('⚠️ Query rewriting failed, using original query:', error.message);
    return rawQuery; // Graceful fallback to original query
  }
};

/**
 * Handles a chat query using the Agentic function-calling pattern.
 * @param {string} userMessage 
 * @param {string} userId 
 * @param {Array} messageHistory 
 * @returns {Promise<Object>} The final response and any citations.
 */
const handleChat = async (userMessage, userId, messageHistory = []) => {
  if (process.env.OPENAI_API_KEY === 'dummy_key' || !process.env.OPENAI_API_KEY) {
    return {
      role: 'assistant',
      content: "This is a mock response because the OpenAI API key is not configured. I would normally search your documents and answer the question.",
      citations: []
    };
  }

  const messages = [
    {
      role: "system",
      content: "You are the 'Second Brain' AI assistant. Your job is to answer the user's questions based primarily on their uploaded documents. If the user asks a question, use the `search_knowledge_base` tool to find relevant information. Cite the documents you used."
    },
    ...messageHistory,
    { role: "user", content: userMessage }
  ];

  try {
    // Step 1: Send the conversation and tools to the model
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // using mini for speed/cost in demo
      messages: messages,
      tools: tools,
      tool_choice: "auto",
    });

    const responseMessage = response.choices[0].message;
    const toolCalls = responseMessage.tool_calls;
    let citations = [];

    // Step 2: Check if the model wanted to call a tool
    if (toolCalls) {
      messages.push(responseMessage); // Add the assistant's tool call request to history

      // Step 3: Call the tools
      for (const toolCall of toolCalls) {
        if (toolCall.function.name === 'search_knowledge_base') {
          const args = JSON.parse(toolCall.function.arguments);
          console.log(`🤖 Agent executing tool search_knowledge_base with query: "${args.query}"`);
          
          // Step 3a: Rewrite the query for better semantic search
          const rewrittenQuery = await rewriteQuery(args.query);
          
          // Step 3b: Generate embedding from the REWRITTEN query
          const queryVector = await generateEmbedding(rewrittenQuery);
          
          // Step 3c: Fetch top 10 results from Weaviate
          const rawResults = await searchKnowledgeBase(queryVector, userId, 10);
          
          // Step 3d: Rerank the top 10 down to the best 5 using hybrid scoring
          const results = await hybridRerank(rewrittenQuery, rawResults, 5);
          
          // Map document IDs to filenames for citations
          const docIds = [...new Set(results.map(r => r.documentId))];
          const docs = await Document.find({ _id: { $in: docIds } });
          const docMap = {};
          docs.forEach(d => docMap[d._id.toString()] = d.filename);

          const formattedResults = results.map(r => ({
            source: docMap[r.documentId] || 'Unknown Document',
            content: r.content
          }));

          citations = docs.map(d => ({ id: d._id, filename: d.filename }));

          // Step 4: Add tool response to history
          messages.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name: toolCall.function.name,
            content: JSON.stringify(formattedResults),
          });
        }
      }

      // Step 5: Get the final answer from the model
      const finalResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
      });

      return {
        role: 'assistant',
        content: finalResponse.choices[0].message.content,
        citations: citations
      };
    } else {
      // Model didn't need to call a tool (e.g., standard greeting)
      return {
        role: 'assistant',
        content: responseMessage.content,
        citations: []
      };
    }
  } catch (error) {
    console.error('Agent chat error:', error);
    throw new Error('Failed to generate agent response');
  }
};

module.exports = { handleChat };
