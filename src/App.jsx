import React, { useState, useEffect } from 'react';
import './App.css';
import AuthModal from './components/AuthModal';
import AssignmentModal from './components/AssignmentModal';

function App() {
  const [status, setStatus] = useState('Checking...');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3001/api/health')
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus('offline'));

    fetchAssignments();
  }, []);

  const fetchAssignments = () => {
    fetch('http://localhost:3001/api/assignments')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setAssignments(data);
      })
      .catch((err) => console.error('Error fetching assignments:', err));
  };

  const handleAuthSuccess = (data) => {
    setCurrentUser(data.user?.email || 'Student');
  };

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:3001/api/auth/logout', { method: 'POST' });
      setCurrentUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleAssignmentAdded = (newAssignment) => {
    setAssignments((prev) => [...prev, newAssignment]);
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Assignment Reminder</h1>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem' }}>
            Backend: <strong>{status}</strong>
          </span>
          {currentUser ? (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span className="profile">{currentUser}</span>
              <button
                onClick={handleLogout}
                style={{
                  padding: '6px 12px',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  background: '#ffffff',
                  color: '#111827',
                  fontWeight: '500',
                }}
              >
                Log Out
              </button>
            </div>
          ) : (
            <button
              className="profile"
              onClick={() => setIsAuthOpen(true)}
              style={{ cursor: 'pointer', border: 'none' }}
            >
              Log In / Register
            </button>
          )}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2>Dashboard</h2>
              <p>Welcome to your Assignment Reminder App.</p>
            </div>
            <button
              onClick={() => setIsAssignmentModalOpen(true)}
              style={{
                backgroundColor: '#166534',
                color: '#fff',
                padding: '10px 18px',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              + Add Assignment
            </button>
          </div>

          <div className="dashboard-card">
            <h3>Upcoming Assignments</h3>
            {assignments.length === 0 ? (
              <p>No upcoming assignments yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, marginTop: '16px' }}>
                {assignments.map((item) => (
                  <li
                    key={item.id}
                    style={{
                      borderBottom: '1px solid #e5e7eb',
                      padding: '12px 0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '1.05rem' }}>{item.title}</strong>
                      <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{item.course}</div>
                    </div>
                    <span style={{ fontSize: '0.9rem', color: '#dc2626', fontWeight: '500' }}>
                      Due: {item.dueDate}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </main>
      </div>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      <AssignmentModal
        isOpen={isAssignmentModalOpen}
        onClose={() => setIsAssignmentModalOpen(false)}
        onAssignmentAdded={handleAssignmentAdded}
      />
    </div>
  );
}

export default App;