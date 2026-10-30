import { useEffect, useState } from 'react'
import './NotificationSettings.css'

function getPermission() {
    return 'Notification' in window
        ? Notification.permission
        : 'unsupported'
}

function NotificationSettings({
    userId,
    permissionScreen = false,
    onOpenPermission,
    onBack,
}) {
    const storageKey = `assignment-desktop-enabled:${userId}`

    const [permission, setPermission] = useState(getPermission)
    const [requesting, setRequesting] = useState(false)
    const [message, setMessage] = useState('')

    const [enabled, setEnabled] = useState(() => {
        try {
            return localStorage.getItem(storageKey) !== 'off'
        } catch {
            return true
        }
    })

    useEffect(() => {
        function refreshSettings() {
            setPermission(getPermission())

            try {
                setEnabled(localStorage.getItem(storageKey) !== 'off')
            } catch {
                // Keep the current setting if storage is unavailable.
            }
        }

        window.addEventListener('focus', refreshSettings)
        window.addEventListener('storage', refreshSettings)

        return () => {
            window.removeEventListener('focus', refreshSettings)
            window.removeEventListener('storage', refreshSettings)
        }
    }, [storageKey])

    function toggleNotifications() {
        const nextEnabled = !enabled
        setMessage('')

        try {
            localStorage.setItem(
                storageKey,
                nextEnabled ? 'on' : 'off',
            )
            setEnabled(nextEnabled)
        } catch {
            setMessage('Could not save your notification preference.')
        }
    }

    async function enableNotifications() {
        if (requesting) return

        setRequesting(true)
        setMessage('')

        try {
            const result = getPermission() === 'default'
                ? await Notification.requestPermission()
                : getPermission()

            setPermission(result)

            if (result === 'granted') {
                localStorage.setItem(storageKey, 'on')
                setEnabled(true)
                onBack()
            } else if (result === 'denied') {
                setMessage(
                    'Open the site controls beside your browser’s address bar, then allow Notifications in site settings.',
                )
            } else if (result === 'unsupported') {
                setMessage('This browser does not support device notifications.')
            } else {
                setMessage('Permission was not granted. Notifications remain off.')
            }
        } catch {
            setMessage('Could not enable notifications. Please try again.')
        } finally {
            setRequesting(false)
        }
    }

    const active = enabled && permission === 'granted'
    if (permissionScreen) {
        return (
            <main className="auth-page">
                <section className="auth-card">
                    <button
                        type="button"
                        className="back-button"
                        aria-label="Back to settings"
                        onClick={onBack}
                        disabled={requesting}
                    >
                        ‹
                    </button>

                    <h1>Enable notifications?</h1>
                    <p className="intro">
                        Your reminders, your choice.
                    </p>

                    <div className="permission-bell" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                            <path d="M10 21h4" />
                        </svg>
                    </div>

                    <div className="assignment-save-warning">
                        <strong>ⓘ Notifications are off</strong>
                        <p>
                            Assignments and calendar still work. Allow
                            permission to receive device reminders.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="primary-button"
                        onClick={enableNotifications}
                        disabled={requesting || permission === 'unsupported'}
                    >
                        {requesting
                            ? 'Requesting permission…'
                            : permission === 'denied'
                                ? 'How to open device settings'
                                : 'Enable notifications'}
                    </button>

                    <button
                        type="button"
                        className="secondary-button"
                        disabled={requesting}
                        onClick={() => {
                            try {
                                localStorage.setItem(storageKey, 'off')
                                setEnabled(false)
                                onBack()
                            } catch {
                                setMessage(
                                    'Could not save your notification preference.',
                                )
                            }
                        }}
                    >
                        Keep notifications off
                    </button>

                    <p className="form-message error" role="status">
                        {message}
                    </p>
                </section>
            </main>
        )
    }

    return (
        <section
            className="notification-preferences"
            aria-label="Notification preferences"
        >
            <button
                type="button"
                className="secondary-button"
                role="switch"
                aria-label="Desktop reminder notifications"
                aria-checked={active}
                aria-describedby="notification-preferences-help"
                onClick={() => {
                    if (active) {
                        toggleNotifications()
                    } else {
                        onOpenPermission()
                    }
                }}
            >
                Notifications: {active ? 'On' : 'Off'}
            </button>

            <p id="notification-preferences-help">
                Manage notification permission on your device.
            </p>

            {permission === 'unsupported' && (
                <p>This browser does not support device notifications.</p>
            )}

            {permission === 'denied' && (
                <p>
                    Notifications are blocked. Allow them in this site’s
                    browser settings to use this control.
                </p>
            )}



            <p className="form-message error" role="status">
                {message}
            </p>
        </section>
    )
}

export default NotificationSettings