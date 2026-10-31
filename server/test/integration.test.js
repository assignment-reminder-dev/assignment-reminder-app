const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { Pool } = require('pg');

// Only run against an explicitly selected, disposable database named *_test.
const connectionString = process.env.TEST_DATABASE_URL;
test('PostgreSQL API and sessions', { skip: !connectionString }, async t => {
    assert.match(new URL(connectionString).pathname, /_test$/);
    const pool = new Pool({ connectionString });
    const port = 35139;
    const base = `http://127.0.0.1:${port}`;
    let child;
    async function boot(production = false) {
        child = spawn(process.execPath, [path.join(__dirname, '..', 'index.js')], {
            env: { ...process.env, DATABASE_URL: connectionString, SESSION_SECRET: 'integration-test-secret-at-least-32-characters', PORT: String(port), NODE_ENV: production ? 'production' : 'development' },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let output = '';
        child.stdout.on('data', x => { output += x; });
        child.stderr.on('data', x => { output += x; });
        for (let i = 0; i < 150; i++) {
            if (child.exitCode !== null) throw new Error(output);
            try { if ((await fetch(base + '/api/health')).ok) return; } catch {}
            await new Promise(resolve => setTimeout(resolve, 30));
        }
        throw new Error('Server did not start: ' + output);
    }
    async function stop() {
        if (!child || child.exitCode !== null) return;
        const exited = new Promise(resolve => child.once('exit', resolve));
        child.kill(); await exited;
    }
    async function request(url, method = 'GET', body, cookie, extra = {}) {
        const response = await fetch(base + '/api' + url, {
            method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...extra },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
    }
    try {
        await boot();
        await pool.query('TRUNCATE notifications, assignments, courses, users, session RESTART IDENTITY CASCADE');
        let cookie, other, course, assignment, reminder;
        await t.test('authentication and validation', async () => {
            assert.equal((await request('/assignments')).status, 401);
            assert.equal((await request('/auth/register', 'POST', { name: 'x' })).status, 400);
            const account = { name: 'Test Student', email: 'STUDENT@example.com', password: 'ValidPass123!' };
            assert.equal((await request('/auth/register', 'POST', account)).status, 201);
            assert.equal((await request('/auth/register', 'POST', { ...account, email: 'student@example.com' })).status, 409);
            assert.equal((await request('/auth/login', 'POST', { ...account, password: 'incorrect' })).status, 401);
            const login = await request('/auth/login', 'POST', account); cookie = login.cookie;
            assert.ok(cookie); assert.equal(login.status, 200);
            assert.equal((await request('/auth/me', 'GET', undefined, cookie)).body.user.email, 'student@example.com');
            await request('/auth/register', 'POST', { ...account, email: 'other@example.com' });
            other = (await request('/auth/login', 'POST', { ...account, email: 'other@example.com' })).cookie;
        });
        await t.test('course create, duplicate and edit', async () => {
            const result = await request('/courses', 'POST', { code: 'cs101', name: 'Programming' }, cookie);
            assert.equal(result.status, 201); course = result.body.course;
            assert.equal(course.code, 'CS101');
            assert.equal((await request('/courses', 'POST', { code: 'CS101', name: 'Duplicate' }, cookie)).status, 409);
            assert.equal((await request('/courses/' + course.id, 'PUT', { code: 'CS102', name: 'Updated' }, cookie)).status, 200);
        });
        await t.test('assignment validation, create and camelCase fields', async () => {
            assert.equal((await request('/assignments', 'POST', {}, cookie)).status, 400);
            const result = await request('/assignments', 'POST', { courseId: course.id, title: 'Homework', dueAt: new Date(Date.now() + 30 * 60000).toISOString(), priority: 'High', notes: 'Keep notes', reminderMinutes: 60 }, cookie);
            assert.equal(result.status, 201); assignment = result.body.assignment;
            assert.equal(assignment.courseId, course.id); assert.equal(assignment.courseCode, 'CS102');
            assert.equal(assignment.reminderMinutes, 60); assert.ok(assignment.dueAt.endsWith('Z'));
            assert.equal((await request('/courses', 'GET', undefined, cookie)).body.courses[0].activeAssignmentCount, 1);
        });
        await t.test('ownership protection', async () => {
            assert.deepEqual((await request('/assignments', 'GET', undefined, other)).body.assignments, []);
            assert.equal((await request('/assignments/' + assignment.id + '/status', 'PATCH', { status: 'Completed' }, other)).status, 404);
            assert.equal((await request('/assignments/' + assignment.id, 'DELETE', undefined, other)).status, 404);
            assert.equal((await request('/courses/' + course.id, 'DELETE', undefined, other)).status, 404);
            assert.equal((await request('/assignments', 'POST', { ...assignment, title: 'Stolen' }, other)).status, 400);
        });
        await t.test('reminders deduplicate under concurrent polling, read flags', async () => {
            const results = await Promise.all(Array.from({ length: 4 }, () => request('/notifications', 'GET', undefined, cookie)));
            for (const r of results) { assert.equal(r.status, 200); assert.equal(r.body.notifications.length, 1); assert.equal(r.body.unreadCount, 1); }
            reminder = results[0].body.notifications[0]; assert.equal(reminder.assignmentId, assignment.id); assert.equal(reminder.courseCode, 'CS102');
            assert.equal((await request('/notifications/' + reminder.id + '/read', 'PATCH', {}, other)).status, 404);
            assert.equal((await request('/notifications/' + reminder.id + '/read', 'PATCH', {}, cookie)).status, 200);
            assert.equal((await request('/notifications', 'GET', undefined, cookie)).body.unreadCount, 0);
        });
        await t.test('edit, status, reminder and course removal safeguard', async () => {
            assert.equal((await request('/assignments/' + assignment.id, 'PUT', { ...assignment, title: 'Edited' }, cookie)).status, 200);
            assert.equal((await request('/assignments/' + assignment.id + '/reminder', 'PATCH', { reminderMinutes: 0 }, cookie)).status, 200);
            const result = await request('/assignments/' + assignment.id + '/status', 'PATCH', { status: 'Completed' }, cookie);
            assert.equal(result.body.assignment.status, 'Completed');
            assert.equal((await request('/courses', 'GET', undefined, cookie)).body.courses[0].activeAssignmentCount, 0);
            assert.equal((await request('/courses/' + course.id, 'DELETE', undefined, cookie)).status, 409);
        });
        await t.test('session and assignment persist across server restart', async () => {
            await stop(); await boot();
            assert.equal((await request('/auth/me', 'GET', undefined, cookie)).status, 200);
            assert.equal((await request('/assignments', 'GET', undefined, cookie)).body.assignments[0].title, 'Edited');
        });
        await t.test('delete cascades notifications and permits course removal', async () => {
            assert.equal((await request('/assignments/' + assignment.id, 'DELETE', undefined, cookie)).status, 200);
            assert.deepEqual((await request('/notifications', 'GET', undefined, cookie)).body.notifications, []);
            assert.equal((await request('/courses/' + course.id, 'DELETE', undefined, cookie)).status, 200);
        });
        await t.test('logout invalidates session and unknown API is JSON', async () => {
            assert.equal((await request('/auth/logout', 'POST', {}, cookie)).status, 200);
            assert.equal((await request('/auth/me', 'GET', undefined, cookie)).status, 401);
            const result = await request('/missing'); assert.equal(result.status, 404); assert.equal(result.headers.get('cache-control'), 'no-store');
        });
        await t.test('production proxy cookies use Secure and HttpOnly', async () => {
            await stop(); await boot(true);
            const result = await request('/auth/login', 'POST', { email: 'student@example.com', password: 'ValidPass123!' }, undefined, { 'X-Forwarded-Proto': 'https' });
            assert.equal(result.status, 200); assert.match(result.headers.get('set-cookie'), /Secure/); assert.match(result.headers.get('set-cookie'), /HttpOnly/);
        });
    } finally { await stop(); await pool.end(); }
});
