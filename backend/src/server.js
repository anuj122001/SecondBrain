const http = require('http');
const app = require('./app');
const connectMongoDB = require('./db/mongoose');
const { connectWeaviate } = require('./db/weaviate');
const { startWorker } = require('./workers/processor');

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);

const startServer = async () => {
  await connectMongoDB();
  await connectWeaviate();
  
  // Start the background SQS worker
  startWorker();

  server.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
  });
};

startServer();
