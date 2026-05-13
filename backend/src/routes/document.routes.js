const express = require('express');
const multer = require('multer');
const authenticate = require('../middleware/auth.middleware');
const { uploadDocument, listDocuments, deleteDocument, getDocumentUrl } = require('../controllers/document.controller');

const router = express.Router();

// Configure multer to store files in memory (so we can pass the buffer directly to S3)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

router.post('/upload', authenticate, upload.single('file'), uploadDocument);
router.get('/', authenticate, listDocuments);
router.get('/:id/url', authenticate, getDocumentUrl);
router.delete('/:id', authenticate, deleteDocument);

module.exports = router;
