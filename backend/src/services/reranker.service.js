const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

/**
 * Hybrid Reranker using a Cross-Encoder style approach via OpenAI.
 * Takes a query and a list of candidate chunks, scores each chunk's 
 * relevance to the query, and returns the top-k most relevant results.
 *
 * This combines:
 *  1. The original vector similarity score (from Weaviate)
 *  2. A semantic relevance score (from the LLM acting as a cross-encoder)
 * 
 * @param {string} query - The user's (rewritten) search query
 * @param {Array} candidates - Array of { content, documentId, distance }
 * @param {number} topK - Number of top results to return after reranking
 * @returns {Promise<Array>} Reranked and filtered results
 */
const hybridRerank = async (query, candidates, topK = 5) => {
  if (!candidates || candidates.length === 0) return [];

  // If we don't have a real API key, skip reranking
  if (process.env.OPENAI_API_KEY === 'dummy_key' || !process.env.OPENAI_API_KEY) {
    console.warn('⚠️ No OpenAI key, skipping reranking. Returning raw results.');
    return candidates.slice(0, topK);
  }

  try {
    // Build a prompt that asks the LLM to score each chunk
    const chunksForScoring = candidates.map((c, i) =>
      `[Chunk ${i}]: ${c.content.substring(0, 300)}`
    ).join('\n\n');

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `You are a relevance scoring engine. Given a search query and a list of text chunks, score each chunk's relevance to the query on a scale of 0 to 10 (10 = perfectly relevant, 0 = completely irrelevant).

Output ONLY a valid JSON array of objects with "index" and "score" fields. Example:
[{"index": 0, "score": 8}, {"index": 1, "score": 3}]

Be strict: a chunk must actually contain information that helps answer the query to score above 5.`
        },
        {
          role: "user",
          content: `Query: "${query}"\n\nChunks:\n${chunksForScoring}`
        }
      ]
    });

    const rawOutput = response.choices[0].message.content.trim();

    let cleanOutput = rawOutput;
    if (cleanOutput.startsWith('```')) {
      cleanOutput = cleanOutput
        .replace(/^```json?\n?/, '')
        .replace(/\n?```$/, '');
    }

    const scores = JSON.parse(cleanOutput);

    // Merge LLM scores with vector distance scores for hybrid ranking
    const reranked = candidates.map((candidate, i) => {
      const llmScore = scores.find(s => s.index === i)?.score || 0;
      // Normalize vector distance (lower distance = better, so invert it)
      const vectorScore = candidate.distance != null ? (1 - candidate.distance) * 10 : 5;

      // Hybrid score: 70% LLM relevance + 30% vector similarity
      const hybridScore = (llmScore * 0.7) + (vectorScore * 0.3);

      return { ...candidate, llmScore, vectorScore, hybridScore };
    });

    // Sort by hybrid score (highest first) and take top-k
    reranked.sort((a, b) => b.hybridScore - a.hybridScore);
    const topResults = reranked.slice(0, topK);

    console.log(`🔀 Reranked ${candidates.length} chunks → top ${topK}:`,
      topResults.map(r => `[score: ${r.hybridScore.toFixed(1)}]`).join(', ')
    );
    // Debug: Log reranked content
    // topResults.forEach((chunk, index) => {
    //   console.log(`reranked content [${index}]:`, chunk.content.substring(0, 100) + '...');
    // });
    return topResults;

  } catch (error) {
    console.warn('⚠️ Reranking failed, falling back to raw vector results:', error.message);
    return candidates.slice(0, topK);
  }
};

module.exports = { hybridRerank };
