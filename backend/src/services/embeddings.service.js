const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

/**
 * Generates an embedding for a given text string.
 * @param {string} text 
 * @returns {Promise<number[]>}
 */
const generateEmbedding = async (text) => {
  if (process.env.OPENAI_API_KEY === 'dummy_key' || !process.env.OPENAI_API_KEY) {
    console.warn('⚠️ No OpenAI API key, returning mock embedding vector.');
    // Return a dummy 1536-dimensional vector for local dev without an API key
    return Array(1536).fill(0.01);
  }

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return response.data[0].embedding;
};

module.exports = { generateEmbedding };
