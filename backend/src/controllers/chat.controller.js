const { handleChat } = require('../services/agent.service');

const chat = async (req, res) => {
  try {
    const { message, history } = req.body;
    const userId = req.user.userId;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const response = await handleChat(message, userId, history || []);

    res.status(200).json(response);
  } catch (error) {
    console.error('Chat controller error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
};

module.exports = { chat };
