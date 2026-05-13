const weaviate = require('weaviate-client');

let client;

const connectWeaviate = async () => {
  try {
    const weaviateUrl = process.env.WEAVIATE_URL || 'http://localhost:8080';
    const parsedUrl = new URL(weaviateUrl);
    // Use the v3 client API logic (assuming weaviate-client v3)
    client = await weaviate.connectToLocal({
      host: parsedUrl.hostname,
      port: parsedUrl.port ? parseInt(parsedUrl.port) : 8080,
    });
    
    const isReady = await client.isReady();
    if (isReady) {
      console.log('✅ Weaviate connected successfully');
      await initializeWeaviateSchema();
    } else {
      console.error('❌ Weaviate is not ready');
    }
  } catch (error) {
    console.error('❌ Weaviate connection error:', error);
  }
};

const initializeWeaviateSchema = async () => {
  const className = 'DocumentChunk';
  try {
    // Note: the v3 API uses collections.exists() and collections.create()
    const exists = await client.collections.exists(className);
    if (!exists) {
      console.log(`Creating Weaviate class: ${className}`);
      await client.collections.create({
        name: className,
        description: 'A chunk of text from an uploaded document',
        // If the OpenAI module is enabled in docker-compose:
        // vectorizer: weaviate.configure.vectorizer.text2VecOpenAI(),
        properties: [
          {
            name: 'content',
            dataType: 'text',
            description: 'The text chunk',
          },
          {
            name: 'document_id',
            dataType: 'text',
            description: 'MongoDB Document ID',
          },
          {
            name: 'user_id',
            dataType: 'text',
            description: 'MongoDB User ID',
          },
          {
            name: 'chunk_index',
            dataType: 'int',
            description: 'Index of chunk in doc',
          },
        ],
      });
      console.log(`✅ Weaviate class ${className} created`);
    } else {
      console.log(`✅ Weaviate class ${className} already exists`);
    }
  } catch (error) {
    console.error(`❌ Error initializing Weaviate schema for ${className}:`, error);
  }
};

const getWeaviateClient = () => client;

module.exports = {
  connectWeaviate,
  getWeaviateClient,
};
