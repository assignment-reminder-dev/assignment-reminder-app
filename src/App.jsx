import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [status, setStatus] = useState('Checking...');

  useEffect(() => {
    fetch('http://localhost:3001/api/health')
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus('offline'));
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>Assignment Reminder</h1>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem' }}>
            Backend: <strong>{status}</strong>
          </span>
          <div className="profile">Student</div>
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
    </div>
  );
}

export default App;