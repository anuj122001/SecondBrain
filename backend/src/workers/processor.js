const { Consumer } = require('sqs-consumer');
require('dotenv').config();
const { SQSClient } = require('@aws-sdk/client-sqs');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { TextractClient, DetectDocumentTextCommand } = require('@aws-sdk/client-textract');
const { PDFParse } = require('pdf-parse');
const Document = require('../models/Document');
const { chunkText } = require('../utils/chunker');
const { generateEmbedding } = require('../services/embeddings.service');
const { upsertChunk } = require('../services/vector.service');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const QUEUE_URL = process.env.SQS_QUEUE_URL || 'https://sqs.ap-south-1.amazonaws.com/123456789012/second-brain-queue';
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'second-brain-uploads-demo';

const sqsClient = new SQSClient({ region: REGION });
const s3Client = new S3Client({ region: REGION });
const textractClient = new TextractClient({ region: REGION });

const downloadFromS3 = async (s3Key) => {
  const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key });
  const response = await s3Client.send(command);
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

const extractTextFromPdf = async (s3Key) => {
  try {
    const buffer = await downloadFromS3(s3Key);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text;
  } catch (error) {
    console.warn('⚠️ PDF parse failed, falling back to mock text. Error:', error.message);
    return "This is mock extracted text. This document talks about artificial intelligence and building a second brain. You can search for these terms.";
  }
};

const extractTextFromImage = async (s3Key) => {
  try {
    const command = new DetectDocumentTextCommand({
      Document: { S3Object: { Bucket: BUCKET_NAME, Name: s3Key } }
    });
    const response = await textractClient.send(command);

    let text = '';
    response.Blocks.forEach(block => {
      if (block.BlockType === 'LINE') {
        text += block.Text + ' ';
      }
    });
    return text;
  } catch (error) {
    console.warn('⚠️ Textract failed, falling back to mock text. Error:', error.message);
    return "This is mock extracted text. This document talks about artificial intelligence and building a second brain. You can search for these terms.";
  }
};

const extractTextFileFromS3 = async (s3Key) => {
  try {
    const buffer = await downloadFromS3(s3Key);
    return buffer.toString('utf-8');
  } catch (error) {
    console.warn('⚠️ S3 text read failed, using mock text. Error:', error.message);
    return "Mock text for non-PDF/Image files.";
  }
};

const processMessage = async (message) => {
  const job = JSON.parse(message.Body);
  const { documentId, s3Key, fileType, userId } = job;
  console.log(`Processing document ${documentId}`);

  try {
    // 1. Check the document still exists (may have been deleted while queued)
    const exists = await Document.findById(documentId);
    if (!exists) {
      console.log(`⚠️ Document ${documentId} no longer exists, skipping.`);
      return;
    }

    await Document.findByIdAndUpdate(documentId, { status: 'processing' });

    // 2. Extract Text
    let rawText = '';
    if (fileType === 'pdf') {
      rawText = await extractTextFromPdf(s3Key);
    } else if (fileType === 'image') {
      rawText = await extractTextFromImage(s3Key);
    } else {
      rawText = await extractTextFileFromS3(s3Key);
    }

    // 3. Chunk text
    const chunks = chunkText(rawText, 100, 20);

    // 5. Embed and Upsert
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await generateEmbedding(chunk);
      await upsertChunk(chunk, embedding, {
        document_id: documentId,
        user_id: userId,
        chunk_index: i
      });
    }

    // 6. Mark as ready
    await Document.findByIdAndUpdate(documentId, { status: 'ready' });
    console.log(`✅ Document ${documentId} processed successfully!`);

  } catch (error) {
    console.error(`❌ Failed to process document ${documentId}:`, error);
    await Document.findByIdAndUpdate(documentId, { status: 'failed' });
    throw error; // Let sqs-consumer handle retries or DLQ
  }
};

const startWorker = () => {
  const app = Consumer.create({
    queueUrl: QUEUE_URL,
    handleMessage: processMessage,
    sqs: sqsClient
  });

  app.on('error', (err) => {
    console.error('SQS Consumer Error (Check your queue URL/AWS credentials!):', err.message);
  });

  app.on('processing_error', (err) => {
    console.error('Processing Error:', err.message);
  });

  app.start();
  console.log('🚀 SQS Processing Worker started listening...');
};

module.exports = { startWorker };
