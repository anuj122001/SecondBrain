import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, Bot, Loader } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const MarkdownMessage = ({ content }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      code({ node, inline, className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || '');
        return !inline && match ? (
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={match[1]}
            PreTag="div"
            customStyle={{ borderRadius: '8px', margin: '8px 0', fontSize: '13px' }}
            {...props}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        ) : (
          <code className="inline-code" {...props}>
            {children}
          </code>
        );
      },
    }}
  >
    {content}
  </ReactMarkdown>
);

const ChatInterface = () => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am your **Second Brain**. Ask me anything about your uploaded documents.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');

    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const history = newMessages.slice(1, -1);

      const response = await axios.post('http://localhost:4000/api/chat', {
        message: userMessage,
        history: history
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.data.content,
        citations: response.data.citations
      }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error while trying to answer your question.',
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-container glass-panel">
      <div className="chat-header">
        <Bot size={20} color="var(--accent-primary)" />
        <h2 style={{ fontSize: '16px', fontWeight: '600' }}>AI Assistant</h2>
      </div>

      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <div
              className={`message-bubble ${msg.role === 'assistant' ? 'markdown-body' : ''}`}
              style={{ color: msg.isError ? 'var(--error)' : 'inherit' }}
            >
              {msg.role === 'assistant' ? (
                <MarkdownMessage content={msg.content} />
              ) : (
                msg.content
              )}
            </div>
            {msg.citations && msg.citations.length > 0 && (
              <div className="citations-container">
                {msg.citations.map(cit => (
                  <span key={cit.id} className="citation-chip" title={cit.filename}>
                    📄 {cit.filename.length > 20 ? cit.filename.substring(0, 20) + '...' : cit.filename}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="message assistant">
            <div className="message-bubble">
              <Loader className="animate-spin" size={16} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-container" onSubmit={handleSend}>
        <div className="chat-input-wrapper">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your documents..."
            disabled={isLoading}
          />
          <button type="submit" className="chat-send-btn" disabled={!input.trim() || isLoading}>
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatInterface;
