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

const assignmentQuery = `
  SELECT
    a.id,
    a.course_id AS "courseId",
    c.code AS "courseCode",
    c.name AS "courseName",
    a.title,
    a.due_at AS "dueAt",
    a.priority,
    a.notes,
    a.status,
    a.reminder_minutes AS "reminderMinutes"
  FROM assignments a
  JOIN courses c ON c.id = a.course_id
`;

// View your assignments, earliest deadline first.
router.get('/', async (req, res, next) => {
    const assignments = await db.many(`
    ${assignmentQuery}
    WHERE a.user_id = $1
    ORDER BY a.due_at, a.id
  `, [req.session.userId]);

    res.json({ assignments });
});

// Add an assignment.
router.post('/', async (req, res, next) => {
    const body = req.body || {};
    const errors = {};

    const {
        courseId,
        title,
        dueAt,
        priority,
        reminderMinutes
    } = body;

    const notes = body.notes === undefined ? '' : body.notes;

    const course = Number.isSafeInteger(courseId) && courseId > 0
        ? await db.one(`
        SELECT id FROM courses
        WHERE id = $1 AND user_id = $2
      `, [courseId, req.session.userId])
        : null;

    if (!course) {
        errors.courseId = 'Choose one of your saved courses.';
    }

    if (
        typeof title !== 'string' ||
        !title.trim() ||
        title.trim().length > 200
    ) {
        errors.title = 'Enter an assignment title with 1–200 characters.';
    }

    // The frontend sends the device-local deadline converted to UTC.
    let validDate = false;

    if (
        typeof dueAt === 'string' &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(dueAt)
    ) {
        const parsed = new Date(dueAt);

        validDate =
            Number.isFinite(parsed.getTime()) &&
            parsed.toISOString() === dueAt &&
            parsed.getUTCFullYear() >= 1900 &&
            parsed.getUTCFullYear() <= 9999;
    }

    if (!validDate) {
        errors.dueAt = 'Enter a valid due date and time.';
    }

    if (!['High', 'Medium', 'Low'].includes(priority)) {
        errors.priority = 'Choose High, Medium, or Low priority.';
    }

    if (typeof notes !== 'string' || notes.length > 2000) {
        errors.notes = 'Notes must contain at most 2,000 characters.';
    }

    if (![0, 60, 1440, 2880].includes(reminderMinutes)) {
        errors.reminderMinutes = 'Choose a valid reminder option.';
    }

    if (Object.keys(errors).length) {
        return res.status(400).json({
            message: 'Check your assignment details.',
            errors
        });
    }

    try {
        const result = await db.execute(`
      INSERT INTO assignments (
        user_id,
        course_id,
        title,
        due_at,
        priority,
        notes,
        reminder_minutes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`, [req.session.userId,
            courseId,
            title.trim(),
            dueAt,
            priority,
            notes.trim(),
            reminderMinutes]);

        const assignment = await db.one(`
      ${assignmentQuery}
      WHERE a.id = $1 AND a.user_id = $2
    `, [Number(result.lastInsertRowid), req.session.userId]);

        res.status(201).json({
            message: 'Assignment saved successfully.',
            assignment
        });
    } catch (error) {
        next(error);
    }
});

router.patch('/:id/status', async (req, res, next) => {
    const id = Number(req.params.id);
    const { status } = req.body || {};

    if (
        !/^[1-9]\d*$/.test(req.params.id) ||
        !Number.isSafeInteger(id)
    ) {
        return res.status(400).json({
            message: 'Invalid assignment ID.'
        });
    }

    if (!['Not Started', 'In Progress', 'Completed'].includes(status)) {
        return res.status(400).json({
            message: 'Choose a valid status.'
        });
    }

    try {
        const result = await db.execute(`
      UPDATE assignments
      SET status = $1
      WHERE id = $2 AND user_id = $3
    `, [status, id, req.session.userId]);

        if (!result.changes) {
            return res.status(404).json({
                message: 'Assignment not found.'
            });
        }

        const assignment = await db.one(`
      ${assignmentQuery}
      WHERE a.id = $1 AND a.user_id = $2
    `, [id, req.session.userId]);

        res.json({
            message: 'Status saved successfully.',
            assignment
        });
    } catch (error) {
        next(error);
    }
});

router.put('/:id', async (req, res, next) => {
    const id = Number(req.params.id);

    if (
        !/^[1-9]\d*$/.test(req.params.id) ||
        !Number.isSafeInteger(id)
    ) {
        return res.status(400).json({
            message: 'Invalid assignment ID.'
        });
    }

    const existing = await db.one(`
    SELECT id FROM assignments
    WHERE id = $1 AND user_id = $2
  `, [id, req.session.userId]);

    if (!existing) {
        return res.status(404).json({
            message: 'Assignment not found.'
        });
    }

    const {
        courseId, title, dueAt, priority, reminderMinutes
    } = req.body || {};

    const notes = req.body?.notes ?? '';
    const errors = {};

    const course = Number.isSafeInteger(courseId) && courseId > 0
        ? await db.one(`
        SELECT id FROM courses
        WHERE id = $1 AND user_id = $2
      `, [courseId, req.session.userId])
        : null;

    if (!course) {
        errors.courseId = 'Choose one of your saved courses.';
    }

    if (
        typeof title !== 'string' ||
        !title.trim() ||
        title.trim().length > 200
    ) {
        errors.title = 'Enter a title with 1–200 characters.';
    }

    let validDate = false;

    if (
        typeof dueAt === 'string' &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(dueAt)
    ) {
        const parsed = new Date(dueAt);

        validDate =
            Number.isFinite(parsed.getTime()) &&
            parsed.toISOString() === dueAt &&
            parsed.getUTCFullYear() >= 1900 &&
            parsed.getUTCFullYear() <= 9999;
    }

    if (!validDate) {
        errors.dueAt = 'Enter a valid due date and time.';
    }

    if (!['High', 'Medium', 'Low'].includes(priority)) {
        errors.priority = 'Choose a valid priority.';
    }

    if (typeof notes !== 'string' || notes.length > 2000) {
        errors.notes = 'Notes must contain at most 2,000 characters.';
    }

    if (![0, 60, 1440, 2880].includes(reminderMinutes)) {
        errors.reminderMinutes = 'Choose a valid reminder option.';
    }

    if (Object.keys(errors).length) {
        return res.status(400).json({
            message: 'Check your assignment details.',
            errors
        });
    }

    try {
        await db.execute(`
      UPDATE assignments
      SET course_id = $1, title = $2, due_at = $3,
          priority = $4, notes = $5, reminder_minutes = $6
      WHERE id = $7 AND user_id = $8
    `, [courseId,
            title.trim(),
            dueAt,
            priority,
            notes.trim(),
            reminderMinutes,
            id,
            req.session.userId]);

        const assignment = await db.one(`
      ${assignmentQuery}
      WHERE a.id = $1 AND a.user_id = $2
    `, [id, req.session.userId]);

        res.json({
            message: 'Assignment updated successfully.',
            assignment
        });
    } catch (error) {
        next(error);
    }
});
router.delete('/:id', async (req, res, next) => {
    const id = Number(req.params.id);

    if (
        !/^[1-9]\d*$/.test(req.params.id) ||
        !Number.isSafeInteger(id)
    ) {
        return res.status(400).json({
            message: 'Invalid assignment ID.'
        });
    }

    try {
        const result = await db.execute(`
            DELETE FROM assignments
            WHERE id = $1 AND user_id = $2
        `, [id, req.session.userId]);

        if (!result.changes) {
            return res.status(404).json({
                message: 'Assignment not found.'
            });
        }

        res.json({
            message: 'Assignment deleted successfully.'
        });
    } catch (error) {
        next(error);
    }
});
router.patch('/:id/reminder', async (req, res, next) => {
    const id = Number(req.params.id);
    const { reminderMinutes } = req.body || {};

    if (
        !/^[1-9]\d*$/.test(req.params.id) ||
        !Number.isSafeInteger(id)
    ) {
        return res.status(400).json({
            message: 'Invalid assignment ID.'
        });
    }

    if (![0, 60, 1440, 2880].includes(reminderMinutes)) {
        return res.status(400).json({
            message: 'Choose a valid reminder option.'
        });
    }

    try {
        const result = await db.execute(`
            UPDATE assignments
            SET reminder_minutes = $1
            WHERE id = $2 AND user_id = $3
        `, [reminderMinutes, id, req.session.userId]);

        if (!result.changes) {
            return res.status(404).json({
                message: 'Assignment not found.'
            });
        }

        const assignment = await db.one(`
            ${assignmentQuery}
            WHERE a.id = $1 AND a.user_id = $2
        `, [id, req.session.userId]);

        res.json({
            message: 'Reminder saved successfully.',
            assignment
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;