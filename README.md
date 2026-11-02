# Assignment Reminder App

A responsive web application for university students to organize assignments, track course deadlines, manage task progress, and receive scheduled reminders[cite: 1, 2, 11].

- **Live Application:** [https://assignment-reminder-app.vercel.app/](https://assignment-reminder-app.vercel.app/)
- **Frontend Hosting:** Vercel
- **Backend Hosting:** Render
- **Database:** Neon PostgreSQL (Cloud-hosted with SSL)

---

## Architecture & Technology Stack

- **Frontend:** React (Vite), React Router, Modern CSS
- **Backend:** Node.js, Express[cite: 1, 11]
- **Database Client:** `pg` (Connection Pooling)[cite: 2]
- **Session Management:** `express-session` with secure HTTP-only cookies
- **Testing:** Node.js native test runner (`node --test`)[cite: 5]

---

## Backend API Endpoints

### Assignments
- `GET /api/assignments` - View assignments sorted by earliest deadline first (FR-05)[cite: 1]
- `POST /api/assignments` - Create assignment tied to a user's course with validation (FR-04)[cite: 1]
- `PUT /api/assignments/:id` - Update existing assignment title, due date, priority, and notes (FR-06)[cite: 1]
- `DELETE /api/assignments/:id` - Delete an owned assignment with automatic cascade deletion of reminders (FR-07)[cite: 1]
- `PATCH /api/assignments/:id/status` - Update assignment workflow status: `Not Started`, `In Progress`, `Completed` (FR-08)[cite: 1]
- `PATCH /api/assignments/:id/reminder` - Configure reminder window (Off, 1 hr, 24 hrs, 48 hrs) (FR-10)[cite: 1]

### Notifications & Reminders
- `GET /api/notifications` - Retrieve due reminders with duplicate notification suppression (FR-11)[cite: 3]
- `PATCH /api/notifications/:id/read` - Mark notification as read/acknowledged[cite: 3]

---

## Security & Privacy Controls (FR Review)

1. **User Data Isolation:** Every query explicitly scopes operations using `user_id = $x` based on the authenticated session (`req.session.userId`), preventing unauthorized cross-user access[cite: 1, 3].
2. **Session Security:** Session cookies enforce `httpOnly: true`, `sameSite: 'lax'`, and `secure` in production to prevent client-side script inspection.
3. **Secret Protection:** Database connection strings, ports, and session secrets are managed via `.env` and kept out of version control[cite: 2].
4. **Input Sanitization:** All SQL queries use parameterized arguments (`$1`, `$2`) to eliminate SQL injection vulnerabilities[cite: 1, 2, 3].

---

## Local Development Setup

### 1. Frontend
```bash
npm install
npm run dev