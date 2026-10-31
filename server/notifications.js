const express = require('express');
const db = require('./db');

const router = express.Router();

router.use(async (req, res, next) => {
    const user = req.session.userId
        ? await db.one('SELECT id FROM users WHERE id = $1', [req.session.userId])
        : null;

    if (!user) {
        return res.status(401).json({
            message: 'Please log in.'
        });
    }

    next();
});

// Add reminders whose time has arrived.
// Completed assignments, overdue assignments, and reminders set to Off
// do not generate new notifications.
async function generateReminders(userId, now) {
    await db.execute(`
        INSERT INTO notifications (user_id, assignment_id, due_at, reminder_minutes, reminder_at)
        SELECT user_id, id, due_at, reminder_minutes,
            to_char(due_at::timestamptz AT TIME ZONE 'UTC' - reminder_minutes * INTERVAL '1 minute',
                    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        FROM assignments
        WHERE user_id = $1 AND status != 'Completed'
          AND reminder_minutes IN (60, 1440, 2880)
          AND due_at::timestamptz - reminder_minutes * INTERVAL '1 minute' <= $2::timestamptz
          AND due_at::timestamptz > $2::timestamptz
        ON CONFLICT (assignment_id, due_at, reminder_minutes) DO NOTHING
    `, [userId, new Date(now).toISOString()]);
}

router.get('/', async (req, res, next) => {
    try {
        await generateReminders(req.session.userId, Date.now());

        const notifications = await db.many(`
            SELECT n.id, n.assignment_id AS "assignmentId", n.due_at AS "dueAt",
                n.reminder_minutes AS "reminderMinutes", n.reminder_at AS "reminderAt",
                n.read_at AS "readAt", a.title, c.code AS "courseCode"
            FROM notifications n
            JOIN assignments a ON a.id = n.assignment_id AND a.user_id = n.user_id
            JOIN courses c ON c.id = a.course_id
            WHERE n.user_id = $1
            ORDER BY n.reminder_at DESC, n.id DESC
        `, [req.session.userId]);

        res.json({
            notifications,
            unreadCount: notifications.filter(
                notification => !notification.readAt
            ).length
        });
    } catch (error) {
        next(error);
    }
});

router.patch('/:id/read', async (req, res, next) => {
    const id = Number(req.params.id);

    if (
        !/^[1-9]\d*$/.test(req.params.id) ||
        !Number.isSafeInteger(id)
    ) {
        return res.status(400).json({
            message: 'Invalid notification ID.'
        });
    }

    try {
        const result = await db.execute(`
            UPDATE notifications
            SET read_at = COALESCE(read_at, $1)
            WHERE id = $2 AND user_id = $3
        `, [new Date().toISOString(),
            id,
            req.session.userId]);

        if (!result.changes) {
            return res.status(404).json({
                message: 'Notification not found.'
            });
        }

        res.json({ message: 'Notification marked as read.' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;