const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    unique: true, 
    required: true,
    trim: true,
    lowercase: true,
  },
  password_hash: { 
    type: String, 
    required: true 
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
