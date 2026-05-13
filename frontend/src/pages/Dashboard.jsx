import React, { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { LogOut, UploadCloud, FileText, FileAudio, Image as ImageIcon, Loader, Trash2, Eye } from 'lucide-react';
import ChatInterface from '../components/ChatInterface';

const Dashboard = () => {
  const { user, logout, token } = useContext(AuthContext);
  const [documents, setDocuments] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const fileInputRef = useRef(null);

  const fetchDocuments = async () => {
    try {
      const res = await axios.get('http://localhost:4000/api/documents');
      setDocuments(res.data.documents);
    } catch (error) {
      console.error('Failed to fetch documents', error);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    // Poll for document status updates every 5 seconds
    const interval = setInterval(fetchDocuments, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleUpload = async (file) => {
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    setIsUploading(true);
    try {
      await axios.post('http://localhost:4000/api/documents/upload', formData);
      // Refresh list immediately after upload
      fetchDocuments();
    } catch (error) {
      console.error('Upload failed', error);
      alert('Upload failed: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsUploading(false);
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const onFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUpload(e.target.files[0]);
    }
  };

  const handleView = async (docId) => {
    try {
      const res = await axios.get(`http://localhost:4000/api/documents/${docId}/url`);
      window.open(res.data.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      alert('Could not open document: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Delete this document? This cannot be undone.')) return;
    try {
      await axios.delete(`http://localhost:4000/api/documents/${docId}`);
      setDocuments(prev => prev.filter(d => d._id !== docId));
    } catch (error) {
      alert('Delete failed: ' + (error.response?.data?.error || error.message));
    }
  };

  const getFileIcon = (type) => {
    if (type === 'pdf') return <FileText size={24} />;
    if (type === 'image') return <ImageIcon size={24} />;
    if (type === 'audio') return <FileAudio size={24} />;
    return <FileText size={24} />;
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div>
          <h1>Your Second Brain</h1>
          <p style={{ color: 'var(--text-muted)' }}>{user.email}</p>
        </div>
        <div className="dashboard-actions">
          <button className="btn-primary" onClick={logout} style={{ background: 'transparent', border: '1px solid var(--panel-border)' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      <div className="dashboard-layout">
        <div className="dashboard-main">
          <div 
            className={`upload-zone ${isDragging ? 'drag-active' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={onFileSelect}
              accept=".pdf,.png,.jpg,.jpeg,.mp3,.wav,.txt"
            />
            {isUploading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <Loader className="animate-spin upload-icon" size={48} />
                <p>Uploading to your Second Brain...</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <UploadCloud className="upload-icon" size={48} />
                <h3>Drag & drop files here</h3>
                <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
                  Supports PDF, Images, Audio, and Text files
                </p>
              </div>
            )}
          </div>

          <div>
            <h2 style={{ marginBottom: '20px', fontSize: '20px' }}>Your Knowledge Base</h2>
            {loadingDocs ? (
              <div style={{ textAlign: 'center', padding: '40px' }}><Loader className="animate-spin" /></div>
            ) : documents.length === 0 ? (
              <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No documents yet. Upload something to get started!
              </div>
            ) : (
              <div className="documents-grid">
                {documents.map((doc) => (
                  <div key={doc._id} className="document-card glass-panel">
                    <div className="document-card-header">
                      <div className="document-icon">
                        {getFileIcon(doc.file_type)}
                      </div>
                      <div className="document-info">
                        <h3 title={doc.filename}>{doc.filename.length > 25 ? doc.filename.substring(0, 25) + '...' : doc.filename}</h3>
                        <p>{new Date(doc.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto', flexShrink: 0 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleView(doc._id); }}
                          title="View document"
                          className="doc-action-btn"
                          onMouseEnter={e => e.currentTarget.style.color = '#818cf8'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(doc._id); }}
                          title="Delete document"
                          className="doc-action-btn"
                          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className={`status-badge status-${doc.status}`}>
                      {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Chat Sidebar */}
        <div className="dashboard-sidebar">
          <ChatInterface />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
