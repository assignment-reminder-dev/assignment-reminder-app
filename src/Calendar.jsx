import { useEffect, useState } from 'react'
import './Calendar.css'
import './Assignments.css'

function sameDay(first, second) {
    return first.getFullYear() === second.getFullYear() &&
        first.getMonth() === second.getMonth() &&
        first.getDate() === second.getDate()
}

function Calendar({ onBack, onOpenAssignment, navigation }) {
    const [selectedDate, setSelectedDate] = useState(() => new Date())
    const [month, setMonth] = useState(() => {
        const today = new Date()
        return new Date(today.getFullYear(), today.getMonth(), 1)
    })
    const [assignments, setAssignments] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [retry, setRetry] = useState(0)

    useEffect(() => {
        const controller = new AbortController()

        async function loadAssignments() {
            setLoading(true)
            setError('')

            try {
                const response = await fetch('/api/assignments', {
                    signal: controller.signal,
                })
                const data = await response.json()

                if (!response.ok) {
                    throw new Error(
                        data.message || 'Could not load assignments.',
                    )
                }

                if (!controller.signal.aborted) {
                    setAssignments(data.assignments)
                }
            } catch (failure) {
                if (!controller.signal.aborted) {
                    setError(
                        failure instanceof TypeError
                            ? 'Unable to reach the server. Please retry.'
                            : failure.message,
                    )
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false)
            }
        }

        loadAssignments()
        return () => controller.abort()
    }, [retry])

    function changeMonth(direction) {
        const next = new Date(
            month.getFullYear(),
            month.getMonth() + direction,
            1,
        )

        setMonth(next)
        setSelectedDate(next)
    }

    const year = month.getFullYear()
    const monthIndex = month.getMonth()
    const firstDay = (month.getDay() + 6) % 7
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
    const cellCount = Math.ceil((firstDay + daysInMonth) / 7) * 7

    const selectedAssignments = assignments
        .filter(assignment =>
            sameDay(new Date(assignment.dueAt), selectedDate),
        )
        .sort((first, second) =>
            new Date(first.dueAt).getTime() -
            new Date(second.dueAt).getTime(),
        )

    return (
        <main className="dashboard-page">
            <div className="calendar-container">
                <button
                    type="button"
                    className="back-button"
                    aria-label="Back to dashboard"
                    onClick={onBack}
                >
                    ‹
                </button>

                <h1>Your calendar</h1>

                <p className="calendar-month" aria-live="polite">
                    {month.toLocaleDateString(undefined, {
                        month: 'long',
                        year: 'numeric',
                    })}
                </p>

                <div className="calendar-month-controls">
                    <button
                        type="button"
                        onClick={() => changeMonth(-1)}
                    >
                        ‹ Previous
                    </button>

                    <button
                        type="button"
                        onClick={() => changeMonth(1)}
                    >
                        Next ›
                    </button>
                </div>

                <section
                    className="calendar-panel"
                    aria-label="Choose a date"
                >
                    <div className="calendar-grid">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
                            .map(day => (
                                <span className="calendar-weekday" key={day}>
                                    {day}
                                </span>
                            ))}

                        {Array.from({ length: cellCount }, (_, index) => {
                            const day = index - firstDay + 1

                            if (day < 1 || day > daysInMonth) {
                                return <span key={index} aria-hidden="true" />
                            }

                            const date = new Date(year, monthIndex, day)
                            const selected = sameDay(date, selectedDate)
                            const today = sameDay(date, new Date())
                            const count = loading || error ? 0 : assignments.filter(
                                assignment =>
                                    sameDay(new Date(assignment.dueAt), date),
                            ).length

                            const label = date.toLocaleDateString(undefined, {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                            })

                            return (
                                <button
                                    type="button"
                                    key={index}
                                    className={`calendar-day ${today ? 'calendar-day-today' : ''
                                        } ${selected ? 'calendar-day-selected' : ''
                                        }`}
                                    aria-pressed={selected}
                                    aria-current={today ? 'date' : undefined}
                                    aria-label={
                                        `${label}${today ? ', today' : ''
                                        }, ${loading || error
                                            ? 'assignments not loaded'
                                            : `${count} ${count === 1
                                                ? 'assignment'
                                                : 'assignments'
                                            }`
                                        }`
                                    }
                                    onClick={() => setSelectedDate(date)}
                                >
                                    <span>{day}</span>

                                    {count > 0 && (
                                        <span
                                            className="calendar-assignment-mark"
                                            aria-hidden="true"
                                        />
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </section>

                <p className="calendar-helper">
                    Underlined dates have assignments.
                </p>
                {sameDay(selectedDate, new Date()) && (
                    <p className="calendar-today-label">
                        Today’s date: {selectedDate.toLocaleDateString(undefined, {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                        })}
                    </p>
                )}

                {loading ? (
                    <p role="status">Loading assignments…</p>
                ) : error ? (
                    <>
                        <p className="error" role="alert">{error}</p>

                        <button
                            type="button"
                            className="secondary-button"
                            onClick={() => setRetry(current => current + 1)}
                        >
                            Retry
                        </button>
                    </>
                ) : (
                    <section aria-label="Assignments for the selected date">
                        <h2 className="calendar-day-heading" aria-live="polite">
                            {selectedDate.toLocaleDateString(undefined, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                            })}
                            {' · '}
                            {selectedAssignments.length}{' '}
                            {selectedAssignments.length === 1
                                ? 'assignment'
                                : 'assignments'}
                        </h2>

                        {selectedAssignments.length === 0 ? (
                            <p className="calendar-helper">
                                No assignments due on this date.
                            </p>
                        ) : (
                            <ul className="assignment-list">
                                {selectedAssignments.map(assignment => {
                                    const deadline = new Date(assignment.dueAt)
                                    const overdue =
                                        assignment.status !== 'Completed' &&
                                        deadline.getTime() < Date.now()

                                    const statusClass = overdue
                                        ? 'assignment-status-overdue'
                                        : assignment.status === 'Not Started'
                                            ? 'assignment-status-neutral'
                                            : 'assignment-status-teal'

                                    return (
                                        <li
                                            className="assignment-card"
                                            key={assignment.id}
                                        >
                                            <div className="assignment-card-header">
                                                <strong>
                                                    {assignment.courseCode}
                                                </strong>

                                                <span
                                                    className={
                                                        `assignment-priority priority-${assignment.priority.toLowerCase()
                                                        }`
                                                    }
                                                >
                                                    {assignment.priority}
                                                </span>
                                            </div>

                                            <h3>
                                                <button
                                                    type="button"
                                                    className="assignment-title-button"
                                                    onClick={() =>
                                                        onOpenAssignment(assignment)
                                                    }
                                                >
                                                    {assignment.title}
                                                </button>
                                            </h3>

                                            <p>
                                                {deadline.toLocaleTimeString(
                                                    undefined,
                                                    {
                                                        hour: 'numeric',
                                                        minute: '2-digit',
                                                    },
                                                )}
                                            </p>

                                            <p
                                                className={
                                                    `assignment-status ${statusClass}`
                                                }
                                            >
                                                {overdue ? 'Overdue | ' : ''}
                                                {assignment.status}
                                            </p>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </section>
                )}
            </div>

            {navigation}
        </main>
    )
}

export default Calendar