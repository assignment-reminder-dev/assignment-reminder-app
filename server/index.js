const session = require('express-session');
const express = require('express');
const path = require('node:path');
const bcrypt = require('bcryptjs');
require('dotenv').config({
    path: path.join(__dirname, '.env')
});

const PgStore = require('connect-pg-simple')(session);
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
const production = process.env.NODE_ENV === 'production';
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 characters. Keep the same value across restarts.');
}
if (production) app.set('trust proxy', 1);
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

app.use(express.json({ limit: '10kb' }));
app.use(session({
    name: 'assignment.sid',
    secret: process.env.SESSION_SECRET,
    store: new PgStore({ pool: db.pool, createTableIfMissing: false }),
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: production,
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

        const existingUser = await db.one('SELECT id FROM users WHERE email = $1', [cleanEmail]);

        if (existingUser) {
            return res.status(409).json({
                message: 'This email is already registered.'
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        let result;

        try {
            result = await db.execute(`
        INSERT INTO users (name, email, password_hash)
        VALUES ($1, $2, $3)
       RETURNING id`, [cleanName, cleanEmail, passwordHash]);
        } catch (error) {
            if (error.code === '23505') {
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

        const user = await db.one('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);

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

app.get('/api/auth/me', async (req, res) => {
    const user = req.session.userId
        ? await db.one('SELECT id, name, email FROM users WHERE id = $1', [req.session.userId])
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
            secure: production
        });

        res.json({ message: 'Logged out successfully.' });
    });
});
app.use('/api/courses', require('./courses'));
app.use('/api/assignments', require('./assignments'));
app.use('/api/notifications', require('./notifications'));
// Return JSON for unknown API endpoints.
app.use('/api', (req, res) => {
    res.status(404).json({
        message: 'API endpoint not found.'
    });
});

// Serve the built React website.
const websitePath = path.join(__dirname, '..', 'dist');

app.use(express.static(websitePath));

app.get(/.*/, (req, res, next) => {
    res.sendFile(path.join(websitePath, 'index.html'), error => {
        if (error) next(error);
    });
});
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

    console.error('Request failed:', error.code || error.name);
    res.status(500).json({
        message: 'Something went wrong. Please try again.'
    });
});

async function start() {
    await db.initialize();
    return app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server listening on port ${PORT}`);
    });
}
if (require.main === module) {
    start().catch(error => {
        console.error('Server startup failed:', error.code || error.name);
        process.exit(1);
    });
}
module.exports = { app, start };