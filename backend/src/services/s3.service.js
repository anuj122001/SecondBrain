require('dotenv').config();
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Initialize S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  // Credentials will be loaded from the environment automatically if available
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'second-brain-uploads-demo';

/**
 * Uploads a file buffer to S3 and returns the object key.
 * @param {Buffer} fileBuffer 
 * @param {string} originalname 
 * @param {string} mimetype 
 * @param {string} userId 
 * @returns {Promise<string>} The S3 Key
 */
const uploadToS3 = async (fileBuffer, originalname, mimetype, userId) => {
  const extension = path.extname(originalname);
  const fileId = uuidv4();
  const key = `uploads/${userId}/${fileId}${extension}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: mimetype,
  });

  try {
    // If you don't have AWS configured yet, this will fail. 
    // In a real local test without AWS, you might write to local disk instead.
    await s3Client.send(command);
    return key;
  } catch (error) {
    console.error('S3 Upload Error:', error);
    // Return a dummy key for local testing if S3 fails
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ Falling back to dummy S3 key due to error.');
      return key;
    }
    throw new Error('Failed to upload file to S3');
  }
};

/**
 * Generates a presigned URL to view/download a file from S3.
 * @param {string} s3Key
 * @param {number} expiresInSeconds - defaults to 15 minutes
 * @returns {Promise<string>} Presigned URL
 */
const getPresignedUrl = async (s3Key, expiresInSeconds = 900) => {
  const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key });
  try {
    return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
  } catch (error) {
    console.error('Presigned URL Error:', error);
    if (process.env.NODE_ENV !== 'production') {
      return `http://localhost:4000/mock-preview?key=${encodeURIComponent(s3Key)}`;
    }
    throw new Error('Failed to generate presigned URL');
  }
};

module.exports = {
  uploadToS3,
  getPresignedUrl,
  s3Client,
  BUCKET_NAME
};
