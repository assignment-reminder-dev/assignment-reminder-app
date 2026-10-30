const express = require('express');
const db = require('./db');

const router = express.Router();

// All course requests require a logged-in account.
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

function validateCourse(body) {
    const { code, name } = body || {};
    const errors = {};

    if (
        typeof code !== 'string' ||
        !code.trim() ||
        code.trim().length > 30
    ) {
        errors.code = 'Enter a course code with 1–30 characters.';
    }

    if (
        typeof name !== 'string' ||
        !name.trim() ||
        name.trim().length > 120
    ) {
        errors.name = 'Enter a course name with 1–120 characters.';
    }

    return {
        errors,
        code: typeof code === 'string' ? code.trim().toUpperCase() : '',
        name: typeof name === 'string' ? name.trim() : ''
    };
}

function courseId(req, res, next) {
    const id = Number(req.params.id);

    if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(id)) {
        return res.status(400).json({
            message: 'Invalid course ID.'
        });
    }

    req.courseId = id;
    next();
}

// View your courses.
router.get('/', (req, res) => {
    const courses = db.prepare(`
    SELECT
    c.id,
    c.code,
    c.name,
    (
        SELECT COUNT(*)
        FROM assignments a
        WHERE a.course_id = c.id
          AND a.user_id = c.user_id
          AND a.status != 'Completed'
    ) AS activeAssignmentCount
FROM courses c
WHERE c.user_id = ?
ORDER BY c.code COLLATE NOCASE, c.id
  `).all(req.session.userId);

    res.json({ courses });
});

// Add a course.
router.post('/', (req, res, next) => {
    const { errors, code, name } = validateCourse(req.body);

    if (Object.keys(errors).length) {
        return res.status(400).json({
            message: 'Check your course details.',
            errors
        });
    }

    try {
        const result = db.prepare(`
      INSERT INTO courses (user_id, code, name)
      VALUES (?, ?, ?)
    `).run(req.session.userId, code, name);

        res.status(201).json({
            message: 'Course added successfully.',
            course: {
                id: Number(result.lastInsertRowid),
                code,
                name
            }
        });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({
                message: 'You already have a course with this code.',
                errors: {
                    code: 'Choose a different course code.'
                }
            });
        }

        next(error);
    }
});

// Edit one of your courses.
router.put('/:id', courseId, (req, res, next) => {
    const existing = db.prepare(`
    SELECT id FROM courses
    WHERE id = ? AND user_id = ?
  `).get(req.courseId, req.session.userId);

    if (!existing) {
        return res.status(404).json({
            message: 'Course not found.'
        });
    }

    const { errors, code, name } = validateCourse(req.body);

    if (Object.keys(errors).length) {
        return res.status(400).json({
            message: 'Check your course details.',
            errors
        });
    }

    try {
        db.prepare(`
      UPDATE courses
      SET code = ?, name = ?
      WHERE id = ? AND user_id = ?
    `).run(code, name, req.courseId, req.session.userId);

        res.json({
            message: 'Course updated successfully.',
            course: { id: req.courseId, code, name }
        });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({
                message: 'You already have a course with this code.',
                errors: {
                    code: 'Choose a different course code.'
                }
            });
        }

        next(error);
    }
});

// Remove one of your courses.
router.delete('/:id', courseId, (req, res, next) => {
    try {
        const result = db.prepare(`
      DELETE FROM courses
      WHERE id = ? AND user_id = ?
    `).run(req.courseId, req.session.userId);

        if (!result.changes) {
            return res.status(404).json({
                message: 'Course not found.'
            });
        }

        res.json({
            message: 'Course removed successfully.'
        });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
            return res.status(409).json({
                message:
                    'This course has assignments. Move or delete them before removing the course.'
            });
        }

        next(error);
    }
});

module.exports = router;