const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  filename: { 
    type: String, 
    required: true 
  },
  s3_key: { 
    type: String, 
    required: true 
  },
  file_type: { 
    type: String, 
    required: true 
  }, // pdf, image, audio, text, note
  status: { 
    type: String, 
    default: 'pending' 
  }, // pending | processing | ready | failed
}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);
