# 🧠 Second Brain AI

Second Brain is a locally hostable, agentic AI knowledge base. Everything you upload—PDFs, text files, and images—becomes instantly searchable and queryable. It acts as your own private, highly intelligent Notion AI.

This project was built to showcase a robust production-ready architecture using modern tools like Vector Databases, Message Queues, and AI Function Calling.

## 🏗️ Architecture Stack

- **Frontend**: React (Vite) with a modern Glassmorphism UI
- **Backend API**: Node.js & Express
- **Application Database**: MongoDB
- **Vector Database**: Weaviate (Local Docker)
- **File Storage**: AWS S3 (with local mock fallbacks)
- **Background Processing**: AWS SQS (Message Queue)
- **Text Extraction**: AWS Textract (for PDFs & Images)
- **AI & Embeddings**: OpenAI (`text-embedding-3-small`, `gpt-4o-mini`)

## 📋 Prerequisites

To run this project locally, you will need:
- [Node.js](https://nodejs.org/en/) (v18+ recommended)
- [Docker & Docker Compose](https://www.docker.com/) (required for MongoDB & Weaviate)

*Note: AWS and OpenAI credentials are **optional** for local testing. The application includes safe mock fallbacks that will simulate the AI and cloud processing if keys are not provided.*

## 🚀 Setup & Installation

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd SecondBrain
```

### 2. Start the Databases
The application uses Docker to host MongoDB and Weaviate locally.
```bash
docker compose up -d
```
*(Ensure Docker desktop is running before executing this command)*

### 3. Setup Backend
```bash
cd backend
npm install
```

**Environment Variables:**
Create a `.env` file in the `backend/` directory:
```env
PORT=4000
JWT_SECRET=your_super_secret_key_change_me
MONGO_URI=mongodb://localhost:27017/secondbrain
WEAVIATE_URL=http://localhost:8080

# --- Optional Cloud Services (App will mock these if left blank) ---
# AWS_REGION=ap-south-1
# AWS_ACCESS_KEY_ID=your_aws_key
# AWS_SECRET_ACCESS_KEY=your_aws_secret
# S3_BUCKET_NAME=your_s3_bucket_name
# SQS_QUEUE_URL=your_sqs_queue_url
# OPENAI_API_KEY=your_openai_api_key
```

### 4. Setup Frontend
```bash
# Open a new terminal tab
cd frontend
npm install
```

## 🏃‍♂️ Running the Application

To run the full stack, you need two active terminal windows (assuming your Docker containers are already running).

**Terminal 1: Start the Backend & Worker**
```bash
cd backend
npm run dev
```

**Terminal 2: Start the Frontend**
```bash
cd frontend
npm run dev
```

Once running, navigate to `http://localhost:5173` in your browser. Create an account, upload some files, and start chatting with your Second Brain!

## 🧩 How it Works

1. **Upload**: Users upload documents via the React UI. The backend uploads the raw file to S3 and pushes a job message to an SQS queue.
2. **Process**: A background worker listens to SQS. It downloads the file, uses AWS Textract to extract raw text, and chunks the text into overlapping segments.
3. **Embed**: The worker passes the chunks to OpenAI's embedding model and stores the resulting vectors in Weaviate.
4. **Chat**: When the user asks a question, the Agent uses OpenAI's function calling to autonomously trigger a Vector Search in Weaviate, retrieves the exact document chunks, and synthesizes an answer with citations.
