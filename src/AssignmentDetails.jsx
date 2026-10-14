import { useState } from 'react'
import './Assignments.css'

const reminderLabels = {
    0: 'Off — no reminder',
    60: '1 hour before',
    1440: '1 day before',
    2880: '2 days before',
}

function AssignmentDetails({ assignment, onBack, onUpdated, onEdit }) {
    const [changingStatus, setChangingStatus] = useState(false)
    const [draftStatus, setDraftStatus] = useState(assignment.status)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [success, setSuccess] = useState(false)
    const [confirmingDelete, setConfirmingDelete] = useState(false)

    async function saveStatus(event) {
        event.preventDefault()
        if (saving) return

        setSaving(true)
        setMessage('')
        setSuccess(false)

        try {
            const response = await fetch(
                `/api/assignments/${assignment.id}/status`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: draftStatus }),
                },
            )

            const data = await response.json()

            if (!response.ok) {
                setMessage(data.message || 'Could not save status.')
                return
            }

            onUpdated(data.assignment)
            setChangingStatus(false)
            setSuccess(true)
            setMessage(data.message)
        } catch {
            setMessage('Could not confirm the save. Your selection has been kept.')
        } finally {
            setSaving(false)
        }
    }
    async function deleteAssignment() {
        if (saving) return

        setSaving(true)
        setMessage('')
        setSuccess(false)

        try {
            const response = await fetch(
                `/api/assignments/${assignment.id}`,
                { method: 'DELETE' },
            )

            const data = await response.json()

            if (!response.ok) {
                setMessage(data.message || 'Could not delete the assignment.')
                return
            }
        } catch {
            setMessage(
                'Could not confirm deletion. Return to your assignments to check before retrying.',
            )
            return
        } finally {
            setSaving(false)
        }

        onBack()
    }

    if (confirmingDelete) {
        return (
            <main className="auth-page">
                <section className="auth-card">
                    <h1>Delete assignment?</h1>

                    <p className="intro">
                        Delete “{assignment.title}” from {assignment.courseCode}?
                        This cannot be undone.
                    </p>

                    <button
                        type="button"
                        className="primary-button assignment-delete-button"
                        disabled={saving}
                        onClick={deleteAssignment}
                    >
                        {saving ? 'Deleting…' : 'Delete assignment'}
                    </button>

                    <button
                        type="button"
                        className="secondary-button"
                        disabled={saving}
                        onClick={() => {
                            setConfirmingDelete(false)
                            setMessage('')
                        }}
                    >
                        Cancel
                    </button>

                    <p className="form-message error" role="status">
                        {message}
                    </p>
                </section>
            </main>
        )
    }

    if (changingStatus) {
        return (
            <main className="auth-page">
                <section className="auth-card">
                    <h1>How is it going?</h1>
                    <p className="intro">
                        {assignment.title} · {assignment.courseCode}
                    </p>

                    <form onSubmit={saveStatus}>
                        <fieldset className="status-options" disabled={saving}>
                            <legend className="status-legend">Assignment status</legend>

                            {['Not Started', 'In Progress', 'Completed'].map(status => (
                                <label className="status-option" key={status}>
                                    <input
                                        type="radio"
                                        name="status"
                                        value={status}
                                        checked={draftStatus === status}
                                        onChange={() => {
                                            setDraftStatus(status)
                                            setMessage('')
                                        }}
                                    />
                                    <span>{status}</span>
                                </label>
                            ))}

                            <p className="helper">
                                Choose one status, then save. Cancel keeps the previous status.
                            </p>

                            <button className="primary-button" type="submit">
                                {saving ? 'Saving…' : 'Save status'}
                            </button>
                        </fieldset>
                    </form>

                    <button
                        className="secondary-button"
                        disabled={saving}
                        onClick={() => {
                            setChangingStatus(false)
                            setDraftStatus(assignment.status)
                            setMessage('')
                        }}
                    >
                        Cancel
                    </button>

                    <p className="form-message error" role="status">{message}</p>
                </section>
            </main>
        )
    }
    const deadline = new Date(assignment.dueAt)
    const completed = assignment.status === 'Completed'
    const overdue = !completed && deadline.getTime() < Date.now()
    const dueToday =
        !completed &&
        !overdue &&
        deadline.toDateString() === new Date().toDateString()

    return (
        <main className="auth-page">
            <section className="auth-card assignment-details">
                <button
                    className="back-button"
                    aria-label="Back to assignments"
                    onClick={onBack}
                >
                    ‹
                </button>

                <h1>{assignment.title}</h1>
                <p className="intro">
                    {assignment.courseCode} · {assignment.courseName}
                </p>

                <div className="details-badges">
                    <span
                        className={`assignment-priority priority-${assignment.priority.toLowerCase()}`}
                    >
                        {assignment.priority} priority
                    </span>

                    <span className={completed || assignment.status === 'In Progress'
                        ? 'details-status-positive'
                        : 'details-status-neutral'}
                    >
                        {assignment.status}
                    </span>
                </div>

                <div className="details-deadline">
                    <strong>
                        {deadline.toLocaleDateString(undefined, {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                        })}
                    </strong>

                    <p>
                        {deadline.toLocaleTimeString(undefined, {
                            hour: 'numeric',
                            minute: '2-digit',
                        })}
                        {overdue ? ' · Overdue' : dueToday ? ' · Due today' : ''}
                    </p>
                </div>

                <section className="details-notes">
                    <h2>Notes</h2>
                    <p>{assignment.notes || 'No notes added.'}</p>
                </section>
                <button
                    className="secondary-button"
                    onClick={() => {
                        setDraftStatus(assignment.status)
                        setMessage('')
                        setSuccess(false)
                        setChangingStatus(true)
                    }}
                >
                    Change status: {assignment.status}
                </button>

                <section className="details-reminder">
                    <h2>Reminder</h2>
                    <p>{reminderLabels[assignment.reminderMinutes]}</p>
                </section>
                <button className="secondary-button" onClick={onEdit}>
                    Edit assignment
                </button>
                <button
                    type="button"
                    className="secondary-button assignment-delete-button"
                    onClick={() => {
                        setMessage('')
                        setSuccess(false)
                        setConfirmingDelete(true)
                    }}
                >
                    Delete assignment
                </button>

                <button className="secondary-button" onClick={onBack}>
                    Back to assignments
                </button>
                <p
                    className={`form-message ${success ? 'success' : 'error'}`}
                    role="status"
                >
                    {message}
                </p>
            </section>
        </main>
    )
}

export default AssignmentDetails