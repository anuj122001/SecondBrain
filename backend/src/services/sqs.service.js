const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
require("dotenv").config();

// Initialize SQS Client
const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});


const QUEUE_URL = process.env.SQS_QUEUE_URL || 'https://sqs.ap-south-1.amazonaws.com/123456789012/second-brain-queue';
/**
 * Sends a job to SQS for background processing.
 * @param {Object} jobData 
 */
const sendProcessingJob = async (jobData) => {
  const command = new SendMessageCommand({
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify(jobData),
  });

  try {
    const response = await sqsClient.send(command);
    console.log('✅ Job sent to SQS:', response.MessageId);
    return response.MessageId;
  } catch (error) {
    console.error('SQS Send Error:', error);
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ Falling back to mock SQS send due to error.');
      return 'mock-sqs-id';
    }
    throw new Error('Failed to send job to SQS');
  }
};

module.exports = {
  sendProcessingJob,
  sqsClient
};
