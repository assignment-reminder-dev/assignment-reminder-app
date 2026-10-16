import { useState } from 'react'
import './Notifications.css'

const reminderLabels = {
    60: '1 hour before',
    1440: '1 day before',
    2880: '2 days before',
}

function Notifications({
    notifications,
    loading,
    error,
    openingId,
    onBack,
    onRetry,
    onOpen,
    onSettings,
    navigation,
}) {
    const [filter, setFilter] = useState('all')

    const visibleNotifications = notifications.filter(notification => {
        if (filter === 'all') return true

        return (notification.type ?? 'reminder') === 'reminder'
    })
    return (
        <main className="dashboard-page">
            <div className="notifications-container">
                <button
                    type="button"
                    className="back-button"
                    aria-label="Back to dashboard"
                    onClick={onBack}
                >
                    ‹
                </button>

                <h1>Notifications</h1>

                <p className="section-description">
                    Select a reminder to open its assignment.
                </p>
                <div
                    className="notification-filters"
                    role="group"
                    aria-label="Filter notifications"
                >
                    <button
                        type="button"
                        aria-pressed={filter === 'all'}
                        onClick={() => setFilter('all')}
                    >
                        All
                    </button>

                    <button
                        type="button"
                        aria-pressed={filter === 'reminders'}
                        onClick={() => setFilter('reminders')}
                    >
                        Reminders
                    </button>
                </div>

                {loading ? (
                    <p role="status">Loading notifications…</p>
                ) : error ? (
                    <div>
                        <p className="error" role="alert">{error}</p>

                        <button
                            type="button"
                            className="secondary-button"
                            onClick={onRetry}
                        >
                            Retry
                        </button>
                    </div>
                ) : visibleNotifications.length === 0 ? (
                    <div className="notification-empty">
                        <h2>No notifications yet</h2>
                        <p>Your assignment reminders will appear here.</p>
                    </div>
                ) : (
                    <ul className="notification-list">
                        {visibleNotifications.map(notification => (
                            <li key={notification.id}>
                                <button
                                    type="button"
                                    className="notification-card"
                                    disabled={openingId !== null}
                                    onClick={() => onOpen(notification)}
                                >
                                    <span className="notification-card-heading">
                                        <svg
                                            className="notification-icon"
                                            viewBox="0 0 24 24"
                                            aria-hidden="true"
                                        >
                                            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                                            <path d="M10 21h4" />
                                        </svg>

                                        <strong>
                                            Reminder: {notification.title}
                                        </strong>
                                    </span>

                                    {!notification.readAt && (
                                        <span className="notification-unread">
                                            Unread
                                        </span>
                                    )}

                                    <span className="notification-course">
                                        {notification.courseCode} · Due{' '}
                                        {new Date(notification.dueAt)
                                            .toLocaleString(undefined, {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                                hour: 'numeric',
                                                minute: '2-digit',
                                            })}
                                    </span>

                                    <span className="notification-time">
                                        {new Date(notification.reminderAt)
                                            .toLocaleString(undefined, {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: 'numeric',
                                                minute: '2-digit',
                                            })}
                                        {' · '}
                                        {reminderLabels[
                                            notification.reminderMinutes
                                        ]}
                                    </span>

                                    {openingId === notification.id && (
                                        <span role="status">Opening…</span>
                                    )}
                                </button>
                            </li>
                        ))}

                    </ul>
                )}
                <button
                    type="button"
                    className="secondary-button notification-settings-button"
                    onClick={onSettings}
                >
                    Notification settings
                </button>
            </div>

            {navigation}
        </main>
    )
}

export default Notifications