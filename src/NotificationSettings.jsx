import { useEffect, useState } from 'react'

function getPermission() {
    return 'Notification' in window
        ? Notification.permission
        : 'unsupported'
}

function NotificationSettings() {
    const [permission, setPermission] = useState(getPermission)
    const [requesting, setRequesting] = useState(false)
    const [message, setMessage] = useState('')

    useEffect(() => {
        function refreshPermission() {
            setPermission(getPermission())
        }

        window.addEventListener('focus', refreshPermission)

        return () => {
            window.removeEventListener('focus', refreshPermission)
        }
    }, [])

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

    return (
        <section aria-labelledby="notification-settings-heading">
            <h2 id="notification-settings-heading">Notifications</h2>

            {permission === 'unsupported' ? (
                <p>This browser does not support device notifications.</p>
            ) : permission === 'granted' ? (
                <p>Browser permission: Allowed.</p>
            ) : permission === 'denied' ? (
                <p>
                    Browser permission: Blocked. To allow notifications,
                    change this site’s notification permission in your
                    browser settings.
                </p>
            ) : (
                <>
                    <p>Allow notifications for assignment reminders.</p>

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
                </>
            )}

            <p className="form-message error" role="status">
                {message}
            </p>
        </section>
    )
}

export default NotificationSettings