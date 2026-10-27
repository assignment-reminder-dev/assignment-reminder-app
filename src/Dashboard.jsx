import Notifications from './Notifications'
import NotificationSettings from './NotificationSettings'
import Calendar from './Calendar'
import AssignmentDetails from './AssignmentDetails'
import { useEffect, useState } from 'react'
import Courses from './Courses'
import AddAssignment from './AddAssignment'
import './Dashboard.css'
import './Assignments.css'

function Dashboard({ user, onLogout, loading, message }) {
    const [screen, setScreen] = useState(() => {
        try {
            const savedScreen = sessionStorage.getItem(
                `assignment-screen:${user.id}`,
            )

            const pages = [
                'home',
                'calendar',
                'tasks',
                'profile',
                'courses',
                'notifications',
            ]

            return pages.includes(savedScreen) ? savedScreen : 'home'
        } catch {
            return 'home'
        }
    })
    const [selectedAssignment, setSelectedAssignment] = useState(null)
    const [detailsOrigin, setDetailsOrigin] = useState('home')
    const [assignments, setAssignments] = useState([])
    const [fetching, setFetching] = useState(true)
    const [fetchError, setFetchError] = useState('')
    const [retry, setRetry] = useState(0)
    const [savedMessage, setSavedMessage] = useState('')
    const [now, setNow] = useState(Date.now())
    const [notifications, setNotifications] = useState([])
    const [notificationsLoading, setNotificationsLoading] = useState(true)
    const [notificationsError, setNotificationsError] = useState('')
    const [notificationRetry, setNotificationRetry] = useState(0)
    const [openingNotificationId, setOpeningNotificationId] = useState(null)
    useEffect(() => {
        const pages = [
            'home',
            'calendar',
            'tasks',
            'profile',
            'courses',
            'notifications',
        ]

        if (!pages.includes(screen)) return

        try {
            sessionStorage.setItem(
                `assignment-screen:${user.id}`,
                screen,
            )
        } catch {
            // Navigation still works when browser storage is unavailable.
        }
    }, [screen, user.id])

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 30000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        if (screen !== 'home' && screen !== 'tasks') return
        const controller = new AbortController()

        async function loadAssignments() {
            setFetching(true)
            setFetchError('')

            try {
                const response = await fetch('/api/assignments', {
                    signal: controller.signal,
                })
                const data = await response.json()

                if (!response.ok) {
                    throw new Error(data.message || 'Could not load assignments.')
                }

                setAssignments(data.assignments)
                setNow(Date.now())
            } catch (error) {
                if (!controller.signal.aborted) {
                    setFetchError(
                        error instanceof TypeError
                            ? 'Unable to reach the server.'
                            : error.message,
                    )
                }
            } finally {
                if (!controller.signal.aborted) setFetching(false)
            }
        }

        loadAssignments()
        return () => controller.abort()
    }, [screen, retry])

    useEffect(() => {
        const controller = new AbortController()
        let inFlight = false

        async function loadNotifications() {
            if (inFlight) return
            inFlight = true

            try {
                const response = await fetch('/api/notifications', {
                    signal: controller.signal,
                })

                const data = await response.json()

                if (!response.ok) {
                    throw new Error(
                        data.message || 'Could not load notifications.',
                    )
                }

                if (!controller.signal.aborted) {
                    setNotifications(data.notifications)
                    setNotificationsError('')

                    if (
                        'Notification' in window &&
                        Notification.permission === 'granted' &&
                        localStorage.getItem(`assignment-desktop-enabled:${user.id}`) !== 'off'
                    ) {
                        try {
                            const pending = data.notifications.filter(item => {
                                const key =
                                    `assignment-popup:${user.id}:${item.id}`

                                return (
                                    !item.readAt &&
                                    new Date(item.dueAt).getTime() > Date.now() &&
                                    !localStorage.getItem(key)
                                )
                            })

                            if (pending.length > 0) {
                                // Check current assignment details before alerting.
                                const assignmentResponse = await fetch(
                                    '/api/assignments',
                                    { signal: controller.signal },
                                )

                                if (assignmentResponse.ok) {
                                    const assignmentData =
                                        await assignmentResponse.json()

                                    for (const item of pending) {
                                        if (controller.signal.aborted) break

                                        const assignment =
                                            assignmentData.assignments.find(
                                                entry =>
                                                    entry.id === item.assignmentId,
                                            )

                                        // Skip completed or changed reminders.
                                        if (
                                            !assignment ||
                                            assignment.status === 'Completed' ||
                                            assignment.dueAt !== item.dueAt ||
                                            assignment.reminderMinutes !==
                                            item.reminderMinutes ||
                                            new Date(assignment.dueAt).getTime() <=
                                            Date.now()
                                        ) {
                                            continue
                                        }

                                        const key =
                                            `assignment-popup:${user.id}:${item.id}`

                                        if (localStorage.getItem(key)) continue
                                        if (
                                            localStorage.getItem(
                                                `assignment-desktop-enabled:${user.id}`,
                                            ) === 'off'
                                        ) {
                                            break
                                        }

                                        const popup = new Notification(
                                            `Reminder: ${assignment.title}`,
                                            {
                                                body:
                                                    `${assignment.courseCode} · Due ` +
                                                    new Date(
                                                        assignment.dueAt,
                                                    ).toLocaleString(),
                                                tag: key,
                                            },
                                        )

                                        localStorage.setItem(key, 'shown')

                                        popup.onclick = () => {
                                            window.focus()
                                            setScreen('notifications')
                                            popup.close()
                                        }
                                    }
                                }
                            }
                        } catch (popupError) {
                            if (!controller.signal.aborted) {
                                console.warn(
                                    'Could not show reminder popup:',
                                    popupError,
                                )
                            }
                        }
                    }
                }
            } catch (error) {
                if (!controller.signal.aborted) {
                    setNotificationsError(
                        error instanceof TypeError
                            ? 'Unable to reach the server. Please retry.'
                            : error.message,
                    )
                }
            } finally {
                inFlight = false

                if (!controller.signal.aborted) {
                    setNotificationsLoading(false)
                }
            }
        }

        loadNotifications()
        const timer = setInterval(loadNotifications, 30000)

        return () => {
            controller.abort()
            clearInterval(timer)
        }
    }, [notificationRetry, screen, user.id])

    async function openNotification(notification) {
        if (openingNotificationId !== null) return

        setOpeningNotificationId(notification.id)
        setNotificationsError('')

        try {
            const response = await fetch('/api/assignments')
            const data = await response.json()

            if (!response.ok) {
                throw new Error(
                    data.message || 'Could not load the assignment.',
                )
            }

            const assignment = data.assignments.find(
                item => item.id === notification.assignmentId,
            )

            if (!assignment) {
                throw new Error('This assignment is no longer available.')
            }

            const readResponse = await fetch(
                `/api/notifications/${notification.id}/read`,
                { method: 'PATCH' },
            )

            if (!readResponse.ok) {
                const readData = await readResponse.json()
                throw new Error(
                    readData.message || 'Could not update the notification.',
                )
            }

            setNotifications(current =>
                current.map(item =>
                    item.id === notification.id
                        ? {
                            ...item,
                            readAt: item.readAt || new Date().toISOString(),
                        }
                        : item,
                ),
            )

            setSelectedAssignment(assignment)
            setDetailsOrigin('notifications')
            navigate('details')
        } catch (error) {
            setNotificationsError(
                error instanceof TypeError
                    ? 'Unable to reach the server. Please retry.'
                    : error.message,
            )
        } finally {
            setOpeningNotificationId(null)
        }
    }

    function navigate(nextScreen) {
        setSavedMessage('')
        setScreen(nextScreen)
    }
    function renderNavigation() {
        return (
            <nav className="dashboard-nav" aria-label="Main navigation">
                <button
                    type="button"
                    aria-current={screen === 'home' ? 'page' : undefined}
                    onClick={() => navigate('home')}
                >
                    <svg
                        className="dashboard-nav-icon"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path d="M3 10 12 3l9 7" />
                        <path d="M5 9v12h5v-7h4v7h5V9" />
                    </svg>
                    <span>Home</span>
                </button>

                <button
                    type="button"
                    aria-current={screen === 'calendar' ? 'page' : undefined}
                    onClick={() => navigate('calendar')}
                >
                    <svg
                        className="dashboard-nav-icon"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <rect x="3" y="5" width="18" height="16" rx="2" />
                        <path d="M7 3v4M17 3v4M3 11h18" />
                        <path d="M8 15h1M15 15h1M8 18h1M15 18h1" />
                    </svg>
                    <span>Calendar</span>
                </button>

                <button
                    type="button"
                    onClick={() => navigate('add')}
                >
                    <span className="dashboard-nav-add-icon">
                        <svg
                            className="dashboard-nav-icon"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                    </span>
                    <span>Add</span>
                </button>

                <button
                    type="button"
                    aria-current={screen === 'tasks' ? 'page' : undefined}
                    onClick={() => navigate('tasks')}
                >
                    <svg
                        className="dashboard-nav-icon"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path d="m3 6 1 1 2-2M9 6h12" />
                        <path d="m3 12 1 1 2-2M9 12h12" />
                        <path d="m3 18 1 1 2-2M9 18h12" />
                    </svg>
                    <span>Tasks</span>
                </button>

                <button
                    type="button"
                    aria-current={screen === 'profile' ? 'page' : undefined}
                    onClick={() => navigate('profile')}
                >
                    <svg
                        className="dashboard-nav-icon"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <circle cx="12" cy="7" r="4" />
                        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
                    </svg>
                    <span>Profile</span>
                </button>
            </nav>
        )
    }
    if (screen === 'calendar') {
        return (
            <Calendar
                onBack={() => navigate('home')}
                onOpenAssignment={assignment => {
                    setSelectedAssignment(assignment)
                    setDetailsOrigin('calendar')
                    navigate('details')
                }}
                navigation={renderNavigation()}
            />
        )
    }

    if (screen === 'notifications') {
        return (
            <Notifications
                notifications={notifications}
                loading={notificationsLoading}
                error={notificationsError}
                openingId={openingNotificationId}
                onBack={() => navigate('home')}
                onRetry={() => {
                    setNotificationsLoading(true)
                    setNotificationRetry(current => current + 1)
                }}
                onOpen={openNotification}
                navigation={renderNavigation()}
                onSettings={() => navigate('profile')}
            />
        )
    }

    if (screen === 'courses') {
        return (
            <Courses
                onBack={() => navigate('home')}
                onViewAssignments={() => navigate('tasks')}
            />
        )
    }

    if (screen === 'add') {
        return (
            <AddAssignment
                onBack={() => navigate('home')}
                onManageCourses={() => navigate('courses')}
                onSaved={assignment => {
                    setSavedMessage(`Assignment saved: ${assignment.title}`)
                    setScreen('home')
                }}
            />
        )
    }
    if (screen === 'profile') {
        return (
            <main className="auth-page settings-page">
                <section className="auth-card">
                    <button
                        type="button"
                        className="back-button"
                        aria-label="Back to dashboard"
                        onClick={() => navigate('home')}
                        disabled={loading}
                    >
                        ‹
                    </button>

                    <h1>Settings</h1>
                    <p className="intro">Your account and preferences.</p>

                    <div className="account-summary">
                        <strong>{user.name}</strong>
                        <p>{user.email}</p>
                    </div>

                    <button
                        type="button"
                        className="secondary-button"
                        onClick={() => navigate('courses')}
                        disabled={loading}
                    >
                        Manage courses
                    </button>

                    <NotificationSettings
                        key={user.id}
                        userId={user.id}
                    />

                    <section
                        className="settings-text-preference"
                        aria-label="Text size"
                    >
                        <div className="settings-text-row">
                            Text size: Use device setting
                        </div>

                        <p>
                            Use your browser’s zoom or text-size settings
                            to adjust readability. Every status and
                            priority has a text label.
                        </p>
                    </section>

                    <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                            try {
                                sessionStorage.removeItem(
                                    `assignment-screen:${user.id}`,
                                )
                            } catch {
                                // Allow logout even if browser storage is unavailable.
                            }

                            onLogout()
                        }}
                        disabled={loading}
                    >
                        {loading ? 'Logging out…' : 'Log out'}
                    </button>

                    <p className="form-message error" role="status">
                        {message}
                    </p>
                </section>

                {renderNavigation()}
            </main>
        )
    }

    if (screen === 'edit' && selectedAssignment) {
        return (
            <AddAssignment
                key={selectedAssignment.id}
                assignment={selectedAssignment}
                onBack={() => navigate('details')}
                onManageCourses={() => navigate('courses')}
                onSaved={updated => {
                    setSelectedAssignment(updated)
                    setAssignments(current =>
                        current.map(item => item.id === updated.id ? updated : item)
                    )
                    navigate('details')
                }}
            />
        )
    }
    if (screen === 'details' && selectedAssignment) {
        return (
            <AssignmentDetails
                assignment={selectedAssignment}
                onUpdated={updated => {
                    setSelectedAssignment(updated)
                    setAssignments(current =>
                        current.map(item => item.id === updated.id ? updated : item)
                    )
                }}
                onBack={() => {
                    setSelectedAssignment(null)
                    navigate(detailsOrigin)
                }}
                onEdit={() => navigate('edit')}

            />
        )
    }
    const active = assignments.filter(
        assignment => assignment.status !== 'Completed',
    )

    const overdue = active.filter(
        assignment => new Date(assignment.dueAt).getTime() < now,
    )

    const completed = assignments.filter(
        assignment => assignment.status === 'Completed',
    )

    const upcoming = active.filter(
        assignment => new Date(assignment.dueAt).getTime() >= now,
    )

    const countsReady = !fetching && !fetchError

    function assignmentCards(items) {
        return (
            <ul className="assignment-list">
                {items.map(assignment => {
                    const deadline = new Date(assignment.dueAt)
                    const isCompleted = assignment.status === 'Completed'
                    const pastDue = !isCompleted && deadline.getTime() < now
                    const dueToday =
                        !isCompleted &&
                        !pastDue &&
                        deadline.toDateString() === new Date(now).toDateString()

                    const statusColor = pastDue
                        ? 'assignment-status-overdue'
                        : dueToday || assignment.status === 'In Progress' || isCompleted
                            ? 'assignment-status-teal'
                            : 'assignment-status-neutral'

                    return (
                        <li className="assignment-card" key={assignment.id}>
                            <div className="assignment-card-header">
                                <strong>{assignment.courseCode}</strong>
                                <span
                                    className={`assignment-priority priority-${assignment.priority.toLowerCase()}`}
                                >
                                    {assignment.priority}
                                </span>
                            </div>

                            <h3>
                                <button
                                    className="assignment-title-button"
                                    onClick={() => {
                                        setDetailsOrigin(screen)
                                        setSelectedAssignment(assignment)
                                        navigate('details')
                                    }}
                                >
                                    {assignment.title}
                                </button>
                            </h3>
                            <p>
                                {new Date(assignment.dueAt).toLocaleString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                })}
                            </p>

                            <p className={`assignment-status ${statusColor}`}>
                                {pastDue ? 'Overdue | ' : dueToday ? 'Due today | ' : ''}
                                {assignment.status}
                            </p>
                        </li>
                    )
                })}
            </ul>

        )

    }
    if (screen === 'tasks') {
        return (
            <main className="dashboard-page">
                <div className="dashboard-container">
                    <button
                        className="back-button"
                        aria-label="Back to dashboard"
                        onClick={() => navigate('home')}
                    >
                        ‹
                    </button>

                    <h1>All assignments</h1>
                    <p className="section-description">
                        Sorted by due date · earliest first
                    </p>

                    {fetching ? (
                        <p role="status">Loading assignments…</p>
                    ) : fetchError ? (
                        <>
                            <p className="error" role="alert">{fetchError}</p>
                            <button
                                className="secondary-button"
                                onClick={() => setRetry(current => current + 1)}
                            >
                                Retry
                            </button>
                        </>
                    ) : assignments.length === 0 ? (
                        <p>No assignments yet.</p>
                    ) : (
                        <>
                            {active.length > 0 && assignmentCards(active)}

                            {completed.length > 0 && (
                                <section className="dashboard-section">
                                    <h2>Completed ({completed.length})</h2>
                                    {assignmentCards(completed)}
                                </section>
                            )}
                        </>
                    )}

                    <button
                        className="secondary-button"
                        onClick={() => navigate('home')}
                    >
                        Back to dashboard
                    </button>
                </div>
                {renderNavigation()}
            </main>
        )
    }

    return (
        <main className="dashboard-page">
            <div className="dashboard-container">
                <header className="dashboard-header">
                    <div>
                        <button
                            className="dashboard-courses-link"
                            onClick={() => navigate('courses')}
                        >
                            Courses
                        </button>

                        <h1>Your week</h1>
                        <p className="dashboard-intro">
                            {new Date(now).toLocaleDateString(undefined, {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric',
                            })}
                        </p>
                    </div>
                    <button
                        type="button"
                        className="notification-bell"
                        aria-label={
                            notificationsError
                                ? 'Notifications — unable to refresh'
                                : notificationsLoading
                                    ? 'Notifications — loading'
                                    : `Notifications, ${notifications.filter(item => !item.readAt).length
                                    } unread`
                        }
                        onClick={() => navigate('notifications')}
                    >
                        <svg
                            className="notification-icon"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                            <path d="M10 21h4" />
                        </svg>

                        {notifications.some(item => !item.readAt) && (
                            <span className="notification-badge" aria-hidden="true">
                                {notifications.filter(item => !item.readAt).length}
                            </span>
                        )}
                    </button>

                </header>


                <p className="dashboard-save-message" role="status">
                    {savedMessage}
                </p>

                <section className="dashboard-stats" aria-label="Assignment summary">
                    <article className="stat-card">
                        <p>Active</p>
                        <strong>{countsReady ? active.length : '—'}</strong>
                    </article>

                    <article className="stat-card overdue-stat">
                        <p>Overdue</p>
                        <strong>{countsReady ? overdue.length : '—'}</strong>
                    </article>

                    <article className="stat-card completed-stat">
                        <p>Completed</p>
                        <strong>{countsReady ? completed.length : '—'}</strong>
                    </article>
                </section>

                {fetching ? (
                    <p role="status">Loading assignments…</p>
                ) : fetchError ? (
                    <section>
                        <p className="error" role="alert">{fetchError}</p>
                        <button
                            className="secondary-button"
                            onClick={() => setRetry(current => current + 1)}
                        >
                            Retry
                        </button>
                    </section>
                ) : assignments.length === 0 ? (
                    <section className="dashboard-empty">
                        <span className="empty-symbol" aria-hidden="true">✓</span>
                        <h2>No assignments yet</h2>
                        <p>A fresh start for your semester.</p>
                        <p>Add a course, then enter an assignment and its due date.</p>
                    </section>
                ) : (
                    <>


                        <section className="dashboard-section">
                            <div className="assignment-section-heading">
                                <h2>Upcoming assignments</h2>

                                <button
                                    className="view-all-button"
                                    onClick={() => navigate('tasks')}
                                >
                                    View all
                                </button>
                            </div>                            <p className="section-description">
                                Your next deadlines, earliest first.
                            </p>
                            {active.length > 0
                                ? assignmentCards(active)
                                : <p>No active assignments.</p>}
                        </section>

                        {completed.length > 0 && (
                            <section className="dashboard-section">
                                <h2>Completed assignments</h2>
                                {assignmentCards(completed)}
                            </section>
                        )}
                    </>
                )}

                <p className="dashboard-message" role="status">{message}</p>
                <button
                    className="primary-button dashboard-add-button"
                    onClick={() => navigate('add')}
                >
                    + Add assignment
                </button>
                {renderNavigation()}

            </div>
        </main>
    )
}

export default Dashboard