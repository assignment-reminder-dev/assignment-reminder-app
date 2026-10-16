const express = require('express');
const db = require('./db');

const router = express.Router();

router.use((req, res, next) => {
    const user = req.session.userId
        ? db.prepare('SELECT id FROM users WHERE id = ?')
            .get(req.session.userId)
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
const generateReminders = db.transaction((userId, now) => {
    const assignments = db.prepare(`
        SELECT id, due_at, reminder_minutes
        FROM assignments
        WHERE user_id = ?
          AND status != 'Completed'
          AND reminder_minutes IN (60, 1440, 2880)
    `).all(userId);

    const insert = db.prepare(`
        INSERT INTO notifications (
            user_id,
            assignment_id,
            due_at,
            reminder_minutes,
            reminder_at
        )
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (assignment_id, due_at, reminder_minutes)
        DO NOTHING
    `);

    for (const assignment of assignments) {
        const deadline = new Date(assignment.due_at).getTime();

        if (!Number.isFinite(deadline)) continue;

        const reminderTime =
            deadline - assignment.reminder_minutes * 60 * 1000;

        if (reminderTime <= now && now < deadline) {
            insert.run(
                userId,
                assignment.id,
                assignment.due_at,
                assignment.reminder_minutes,
                new Date(reminderTime).toISOString()
            );
        }
    }
});

router.get('/', (req, res, next) => {
    try {
        generateReminders(req.session.userId, Date.now());

        const notifications = db.prepare(`
            SELECT
                n.id,
                n.assignment_id AS assignmentId,
                n.due_at AS dueAt,
                n.reminder_minutes AS reminderMinutes,
                n.reminder_at AS reminderAt,
                n.read_at AS readAt,
                a.title,
                c.code AS courseCode
            FROM notifications n
            JOIN assignments a
                ON a.id = n.assignment_id AND a.user_id = n.user_id
            JOIN courses c ON c.id = a.course_id
            WHERE n.user_id = ?
            ORDER BY n.reminder_at DESC, n.id DESC
        `).all(req.session.userId);

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

router.patch('/:id/read', (req, res, next) => {
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
        const result = db.prepare(`
            UPDATE notifications
            SET read_at = COALESCE(read_at, ?)
            WHERE id = ? AND user_id = ?
        `).run(
            new Date().toISOString(),
            id,
            req.session.userId
        );

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