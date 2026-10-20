import { useEffect, useState } from 'react'
import './NotificationSettings.css'

function getPermission() {
    return 'Notification' in window
        ? Notification.permission
        : 'unsupported'
}

function NotificationSettings({ userId }) {
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
            const result = await Notification.requestPermission()
            setPermission(result)

            if (result === 'default') {
                setMessage('No permission selected. You can try again later.')
            }
        } catch {
            setMessage('Could not request notification permission.')
        } finally {
            setRequesting(false)
        }
    }

    const active = enabled && permission === 'granted'

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
                disabled={permission !== 'granted'}
                onClick={toggleNotifications}
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

            {permission === 'default' && (
                <button
                    type="button"
                    className="secondary-button"
                    onClick={enableNotifications}
                    disabled={requesting}
                >
                    {requesting
                        ? 'Requesting permission…'
                        : 'Enable notifications'}
                </button>
            )}

            <p className="form-message error" role="status">
                {message}
            </p>
        </section>
    )
}

export default NotificationSettings