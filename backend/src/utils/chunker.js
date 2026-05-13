/**
 * Simple word-based chunker. 
 * For a real app, use something like langchain's RecursiveCharacterTextSplitter.
 */
const chunkText = (text, chunkSize = 400, chunkOverlap = 50) => {
  if (!text) return [];
  
  const words = text.split(/\s+/);
  const chunks = [];
  
  let i = 0;
  while (i < words.length) {
    const chunkWords = words.slice(i, i + chunkSize);
    chunks.push(chunkWords.join(' '));
    i += (chunkSize - chunkOverlap);
  }
  
  return chunks;
};

module.exports = { chunkText };
