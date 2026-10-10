import React, { useState } from 'react';
import './AssignmentModal.css';

function AssignmentModal({ isOpen, onClose, onAssignmentAdded }) {
  const [title, setTitle] = useState('');
  const [course, setCourse] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:3001/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, course, dueDate }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to save assignment');
      }

      onAssignmentAdded(data);
      setTitle('');
      setCourse('');
      setDueDate('');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2>New Assignment</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        {error && <div className="modal-error">{error}</div>}

        <form onSubmit={handleSubmit} className="assignment-form">
          <div className="input-group">
            <label>Assignment Title</label>
            <input
              type="text"
              required
              placeholder="e.g., Recitation 05"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>Course</label>
            <input
              type="text"
              required
              placeholder="e.g., CSCE 3600"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>Due Date</label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Adding...' : 'Add Assignment'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AssignmentModal;