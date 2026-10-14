const session = require('express-session');
const { randomBytes } = require('node:crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
const PORT = 3001;

app.use(express.json({ limit: '10kb' }));
app.use(session({
    name: 'assignment.sid',
    secret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: 'Assignment Reminder' });
});

app.post('/api/auth/register', async (req, res, next) => {
    try {
        const { name, email, password } = req.body || {};

        if (
            typeof name !== 'string' ||
            typeof email !== 'string' ||
            typeof password !== 'string'
        ) {
            return res.status(400).json({
                message: 'Name, email, and password are required.'
            });
        }

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (cleanName.length < 2 || cleanName.length > 100) {
            return res.status(400).json({
                message: 'Name must contain 2–100 characters.'
            });
        }

        if (
            cleanEmail.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
        ) {
            return res.status(400).json({
                message: 'Enter a valid email address.'
            });
        }

        if (
            password.length < 8 ||
            Buffer.byteLength(password, 'utf8') > 72
        ) {
            return res.status(400).json({
                message: 'Password must be at least 8 characters and at most 72 bytes.'
            });
        }

        const existingUser = db.prepare(
            'SELECT id FROM users WHERE email = ?'
        ).get(cleanEmail);

        if (existingUser) {
            return res.status(409).json({
                message: 'This email is already registered.'
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        let result;

        try {
            result = db.prepare(`
        INSERT INTO users (name, email, password_hash)
        VALUES (?, ?, ?)
      `).run(cleanName, cleanEmail, passwordHash);
        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return res.status(409).json({
                    message: 'This email is already registered.'
                });
            }

            throw error;
        }

        res.status(201).json({
            message: 'Account created successfully.',
            user: {
                id: Number(result.lastInsertRowid),
                name: cleanName,
                email: cleanEmail
            }
        });
    } catch (error) {
        next(error);
    }
});
app.post('/api/auth/login', async (req, res, next) => {
    try {
        const { email, password } = req.body || {};

        if (
            typeof email !== 'string' ||
            typeof password !== 'string' ||
            !email.trim() ||
            !password ||
            email.length > 254 ||
            Buffer.byteLength(password, 'utf8') > 72
        ) {
            return res.status(400).json({
                message: 'Enter a valid email and password.'
            });
        }

        const user = db.prepare(
            'SELECT * FROM users WHERE email = ?'
        ).get(email.trim().toLowerCase());

        const validPassword = user
            ? await bcrypt.compare(password, user.password_hash)
            : false;

        if (!validPassword) {
            return res.status(401).json({
                message: 'Incorrect email or password.'
            });
        }

        req.session.regenerate(error => {
            if (error) return next(error);

            req.session.userId = user.id;

            req.session.save(error => {
                if (error) return next(error);

                res.json({
                    message: 'Logged in successfully.',
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email
                    }
                });
            });
        });
    } catch (error) {
        next(error);
    }
});

app.get('/api/auth/me', (req, res) => {
    const user = req.session.userId
        ? db.prepare(
            'SELECT id, name, email FROM users WHERE id = ?'
        ).get(req.session.userId)
        : null;

    if (!user) {
        return res.status(401).json({
            message: 'Please log in.'
        });
    }

    res.json({ user });
});

app.post('/api/auth/logout', (req, res, next) => {
    req.session.destroy(error => {
        if (error) return next(error);

        res.clearCookie('assignment.sid', {
            httpOnly: true,
            sameSite: 'lax',
            secure: false
        });

        res.json({ message: 'Logged out successfully.' });
    });
});
app.use('/api/courses', require('./courses'));
app.use('/api/assignments', require('./assignments'));
app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({
            message: 'Invalid JSON request.'
        });
    }

    if (error.status === 413) {
        return res.status(413).json({
            message: 'Request is too large.'
        });
    }

    console.error(error);
    res.status(500).json({
        message: 'Something went wrong. Please try again.'
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});