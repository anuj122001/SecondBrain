const Document = require('../models/Document');
const { uploadToS3, getPresignedUrl, s3Client, BUCKET_NAME } = require('../services/s3.service');
const { sendProcessingJob } = require('../services/sqs.service');
const { deleteChunksByDocumentId } = require('../services/vector.service');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');

const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { originalname, mimetype, buffer } = req.file;
    const userId = req.user.userId;

    // 1. Upload to S3
    const s3Key = await uploadToS3(buffer, originalname, mimetype, userId);

    // 2. Determine file type broadly
    let fileType = 'text';
    if (mimetype.includes('pdf')) fileType = 'pdf';
    else if (mimetype.includes('image')) fileType = 'image';
    else if (mimetype.includes('audio')) fileType = 'audio';

    // 3. Save to MongoDB Database
    const newDoc = new Document({
      user_id: userId,
      filename: originalname,
      s3_key: s3Key,
      file_type: fileType,
      status: 'pending' // Initial status
    });

    await newDoc.save();

    // 4. Send to SQS for background processing
    await sendProcessingJob({
      documentId: newDoc._id,
      userId: userId,
      s3Key: s3Key,
      fileType: fileType
    });

    res.status(201).json({
      message: 'File uploaded successfully and queued for processing',
      document: {
        id: newDoc._id,
        filename: newDoc.filename,
        status: newDoc.status,
        fileType: newDoc.file_type
      }
    });

  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({ error: 'Failed to process file upload' });
  }
};

// Endpoint to list user's documents
const listDocuments = async (req, res) => {
  try {
    const userId = req.user.userId;
    const documents = await Document.find({ user_id: userId }).sort({ createdAt: -1 });
    res.status(200).json({ documents });
  } catch (error) {
    console.error('List documents error:', error);
    res.status(500).json({ error: 'Failed to list documents' });
  }
};

const deleteDocument = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const doc = await Document.findOne({ _id: id, user_id: userId });
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete from S3 (best-effort — ignore if file never made it there)
    try {
      await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: doc.s3_key }));
    } catch (err) {
      console.warn('⚠️ S3 delete skipped:', err.message);
    }

    // Delete vector chunks from Weaviate (best-effort)
    try {
      await deleteChunksByDocumentId(doc._id);
    } catch (err) {
      console.warn('⚠️ Weaviate chunk delete skipped:', err.message);
    }

    await Document.deleteOne({ _id: id });

    res.status(200).json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
};

const getDocumentUrl = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const doc = await Document.findOne({ _id: id, user_id: userId });
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const url = await getPresignedUrl(doc.s3_key);
    res.status(200).json({ url });
  } catch (error) {
    console.error('Presigned URL error:', error);
    res.status(500).json({ error: 'Failed to generate document URL' });
  }
};

module.exports = {
  uploadDocument,
  listDocuments,
  deleteDocument,
  getDocumentUrl
};
