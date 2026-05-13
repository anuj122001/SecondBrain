const express = require('express');
const authenticate = require('../middleware/auth.middleware');
const { chat } = require('../controllers/chat.controller');

const router = express.Router();

router.post('/', authenticate, chat);

module.exports = router;
