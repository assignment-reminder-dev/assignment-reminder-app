import React, { useState, useEffect } from 'react';
import './App.css';
import AuthModal from './components/AuthModal';

function App() {
  const [status, setStatus] = useState('Checking...');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    fetch('http://localhost:3001/api/health')
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus('offline'));
  }, []);

  const handleAuthSuccess = (data) => {
    setCurrentUser(data.user?.email || 'Student');
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Assignment Reminder</h1>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem' }}>
            Backend: <strong>{status}</strong>
          </span>
          <button
            className="profile"
            onClick={() => setIsAuthOpen(true)}
            style={{ cursor: 'pointer', border: 'none' }}
          >
            {currentUser ? currentUser : 'Log In / Register'}
          </button>
        </div>
      </header>

      <div className="layout">
        <nav className="sidebar">
          <h2>Menu</h2>
          <a href="#">Dashboard</a>
          <a href="#">Assignments</a>
          <a href="#">Calendar</a>
          <a href="#">Notifications</a>
        </nav>

        <main className="content">
          <h2>Dashboard</h2>
          <p>Welcome to your Assignment Reminder App.</p>

          <div className="dashboard-card">
            <h3>Upcoming Assignments</h3>
            <p>Your upcoming assignments will appear here.</p>
          </div>
        </main>
      </div>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}

export default App;