const { getWeaviateClient } = require('../db/weaviate');

/**
 * Upserts a chunk with its embedding into Weaviate.
 * @param {string} textContent 
 * @param {number[]} vector 
 * @param {Object} metadata { document_id, user_id, chunk_index }
 */
const upsertChunk = async (textContent, vector, metadata) => {
  const client = getWeaviateClient();
  if (!client) {
    throw new Error('Weaviate client not initialized');
  }

  const collection = client.collections.get('DocumentChunk');

  await collection.data.insert({
    properties: {
      content: textContent,
      document_id: metadata.document_id.toString(),
      user_id: metadata.user_id.toString(),
      chunk_index: metadata.chunk_index
    },
    vectors: vector // Explicitly providing the OpenAI vector
  });
};

/**
 * Searches Weaviate for the most relevant chunks based on a query vector.
 * @param {number[]} queryVector 
 * @param {string} userId 
 * @param {number} limit 
 */
const searchKnowledgeBase = async (queryVector, userId, limit = 5) => {
  const client = getWeaviateClient();
  if (!client) {
    throw new Error('Weaviate client not initialized');
  }

  const collection = client.collections.get('DocumentChunk');

  const response = await collection.query.nearVector(queryVector, {
    limit: limit,
    returnProperties: ['content', 'document_id', 'chunk_index'],
    // Filter by the user who owns the document
    filters: collection.filter.byProperty('user_id').equal(userId)
  });

  return response.objects.map(obj => ({
    content: obj.properties.content,
    documentId: obj.properties.document_id,
    distance: obj.metadata?.distance
  }));
};

const deleteChunksByDocumentId = async (documentId) => {
  const client = getWeaviateClient();
  if (!client) return;

  const collection = client.collections.get('DocumentChunk');
  await collection.data.deleteMany(
    collection.filter.byProperty('document_id').equal(documentId.toString())
  );
};

module.exports = { upsertChunk, searchKnowledgeBase, deleteChunksByDocumentId };
