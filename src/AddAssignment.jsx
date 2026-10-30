import { useEffect, useState } from 'react'
import './Assignments.css'

function AddAssignment({ onBack, onSaved, onManageCourses, assignment = null }) {
    const [courses, setCourses] = useState([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')
    const [retry, setRetry] = useState(0)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [errors, setErrors] = useState({})
    const [saveFailed, setSaveFailed] = useState(false)
    const [validationMode, setValidationMode] = useState(false)

    const [form, setForm] = useState(() => {
        if (!assignment) {
            return {
                courseId: '',
                title: '',
                date: '',
                time: '',
                priority: 'Medium',
                notes: '',
                reminderMinutes: '1440',
            }
        }

        const deadline = new Date(assignment.dueAt)
        const pad = value => String(value).padStart(2, '0')

        return {
            courseId: String(assignment.courseId),
            title: assignment.title,
            date: [
                deadline.getFullYear(),
                pad(deadline.getMonth() + 1),
                pad(deadline.getDate()),
            ].join('-'),
            time: `${pad(deadline.getHours())}:${pad(deadline.getMinutes())}`,
            priority: assignment.priority,
            notes: assignment.notes,
            reminderMinutes: String(assignment.reminderMinutes),
        }
    })

    useEffect(() => {
        const controller = new AbortController()

        async function loadCourses() {
            setLoading(true)
            setLoadError('')

            try {
                const response = await fetch('/api/courses', {
                    signal: controller.signal,
                })
                const data = await response.json()

                if (!response.ok) {
                    throw new Error(data.message || 'Could not load courses.')
                }

                setCourses(data.courses)
            } catch (error) {
                if (!controller.signal.aborted) {
                    setLoadError(
                        error instanceof TypeError
                            ? 'Unable to reach the server.'
                            : error.message,
                    )
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false)
            }
        }

        loadCourses()
        return () => controller.abort()
    }, [retry])

    function changeField(event) {
        const { name, value } = event.target
        setForm(current => ({ ...current, [name]: value }))
        setErrors({})
        setMessage('')
    }

    function fieldError(name) {
        return errors[name] ? (
            <small className="assignment-error" id={`${name}-error`}>
                {errors[name]}
            </small>
        ) : null
    }

    function errorAttributes(name) {
        return {
            'aria-invalid': Boolean(errors[name]),
            'aria-describedby': errors[name] ? `${name}-error` : undefined,
        }
    }

    async function saveAssignment(event) {
        event.preventDefault()
        if (saving) return

        setErrors({})
        setMessage('')

        const validationErrors = {}

        if (!courses.some(course => course.id === Number(form.courseId))) {
            validationErrors.courseId = 'Choose one of your saved courses.'
        }

        if (!form.title.trim() || form.title.trim().length > 200) {
            validationErrors.title =
                'Enter an assignment title with 1–200 characters.'
        }

        const [year, month, day] = form.date.split('-').map(Number)
        const [hour, minute] = form.time.split(':').map(Number)
        const deadline = new Date(year, month - 1, day, hour, minute)

        if (
            !form.date ||
            !form.time ||
            !Number.isFinite(deadline.getTime()) ||
            year < 1900 ||
            year > 9999 ||
            deadline.getFullYear() !== year ||
            deadline.getMonth() !== month - 1 ||
            deadline.getDate() !== day ||
            deadline.getHours() !== hour ||
            deadline.getMinutes() !== minute
        ) {
            validationErrors.dueAt =
                'Enter a valid due date and time in your time zone.'
        }

        if (!['High', 'Medium', 'Low'].includes(form.priority)) {
            validationErrors.priority = 'Choose a priority.'
        }

        if (form.notes.length > 2000) {
            validationErrors.notes = 'Notes must contain at most 2,000 characters.'
        }

        if (!['0', '60', '1440', '2880'].includes(form.reminderMinutes)) {
            validationErrors.reminderMinutes = 'Choose a reminder option.'
        }

        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors)
            setValidationMode(true)
            setMessage('Check the highlighted fields. Your entries have been kept.')
            return
        }

        setSaving(true)

        try {
            const response = await fetch(
                assignment ? `/api/assignments/${assignment.id}` : '/api/assignments',
                {
                    method: assignment ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        courseId: Number(form.courseId),
                        title: form.title,
                        dueAt: deadline.toISOString(),
                        priority: form.priority,
                        notes: form.notes,
                        reminderMinutes: Number(form.reminderMinutes),
                    }),
                })

            const data = await response.json()

            if (!response.ok) {
                setErrors(data.errors || {})
                if (Object.keys(data.errors || {}).length > 0) {
                    setValidationMode(true)
                }
                setMessage(data.message || 'Could not save your assignment.')

                if (response.status >= 500) {
                    setSaveFailed(true)
                } else {
                    setSaveFailed(false)
                }

                return
            }

            if (!data.assignment) {
                throw new Error('Save confirmation is missing.')
            }

            setSaveFailed(false)
            onSaved(data.assignment)
        } catch {
            setSaveFailed(true)
            setMessage(
                'We could not confirm this save. Reconnect and retry; your entries have been kept.',
            )
        } finally {
            setSaving(false)
        }
    }
    if (saveFailed) {
        return (
            <main className="auth-page">
                <section className="auth-card assignment-form">
                    <button
                        type="button"
                        className="back-button"
                        aria-label="Return to editing"
                        onClick={() => setSaveFailed(false)}
                        disabled={saving}
                    >
                        ‹
                    </button>

                    <h1>Could not save</h1>
                    <p className="intro">
                        Your changes are still in this form.
                    </p>

                    <div className="assignment-save-warning" role="alert">
                        <strong>ⓘ Check your connection</strong>
                        <p>{message}</p>
                    </div>

                    <div className="form-field">
                        <label htmlFor="failed-assignment-title">
                            Assignment title *
                        </label>
                        <input
                            id="failed-assignment-title"
                            value={form.title}
                            readOnly
                        />
                    </div>

                    <div className="form-field">
                        <label htmlFor="failed-assignment-deadline">
                            Due date and time *
                        </label>
                        <input
                            id="failed-assignment-deadline"
                            value={`${form.date} · ${form.time}`}
                            readOnly
                        />
                    </div>

                    <button
                        type="button"
                        className="primary-button"
                        onClick={saveAssignment}
                        disabled={saving}
                    >
                        {saving ? 'Saving…' : 'Retry save'}
                    </button>

                    <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setSaveFailed(false)}
                        disabled={saving}
                    >
                        Return to editing
                    </button>

                    <p className="helper">
                        Show success only after storage confirms the save.
                    </p>
                </section>
            </main>
        )
    }
    return (
        <main className="auth-page">
            <section className="auth-card assignment-form">
                <button
                    className="back-button"
                    aria-label="Back to dashboard"
                    onClick={onBack}
                    disabled={saving}
                >
                    ‹
                </button>

                <h1>
                    {validationMode
                        ? 'Check your entries'
                        : assignment
                            ? 'Edit assignment'
                            : 'Add assignment'}
                </h1>

                <p className="intro" role="status">
                    {validationMode
                        ? 'Assignment has not been saved.'
                        : 'Required fields are marked with *.'}
                </p>

                {loading ? (
                    <p role="status">Loading courses…</p>
                ) : loadError ? (
                    <>
                        <p className="error" role="alert">{loadError}</p>
                        <button
                            className="secondary-button"
                            onClick={() => setRetry(current => current + 1)}
                        >
                            Retry
                        </button>
                    </>
                ) : courses.length === 0 ? (
                    <>
                        <p className="intro">
                            Add a course before creating your first assignment.
                        </p>
                        <button
                            className="primary-button"
                            onClick={onManageCourses}
                        >
                            Manage courses
                        </button>
                    </>
                ) : (
                    <form onSubmit={saveAssignment} noValidate>                        <fieldset disabled={saving}>
                        <div className="form-field">
                            <label htmlFor="assignment-course">Course *</label>
                            <select
                                id="assignment-course"
                                name="courseId"
                                value={form.courseId}
                                onChange={changeField}
                                {...errorAttributes('courseId')}
                                required
                            >
                                <option value="">Choose a course</option>
                                {courses.map(course => (
                                    <option key={course.id} value={course.id}>
                                        {course.code} · {course.name}
                                    </option>
                                ))}
                            </select>
                            {fieldError('courseId')}
                        </div>

                        <div className="form-field">
                            <label htmlFor="assignment-title">Assignment title *</label>
                            <input
                                id="assignment-title"
                                name="title"
                                placeholder="UI wireframe"
                                value={form.title}
                                onChange={changeField}
                                maxLength={200}
                                {...errorAttributes('title')}
                                required
                            />
                            {fieldError('title')}
                        </div>

                        <div className="assignment-date-row">
                            <div className="form-field">
                                <label htmlFor="assignment-date">Due date *</label>
                                <input
                                    id="assignment-date"
                                    name="date"
                                    type="date"
                                    min="1900-01-01"
                                    max="9999-12-31"
                                    value={form.date}
                                    onChange={changeField}
                                    {...errorAttributes('dueAt')}
                                    required
                                />
                            </div>

                            <div className="form-field">
                                <label htmlFor="assignment-time">Due time *</label>
                                <input
                                    id="assignment-time"
                                    name="time"
                                    type="time"
                                    value={form.time}
                                    onChange={changeField}
                                    {...errorAttributes('dueAt')}
                                    required
                                />
                            </div>
                        </div>
                        {fieldError('dueAt')}
                        <div className="form-field">
                            <fieldset
                                className="priority-fieldset"
                                aria-describedby={errors.priority ? 'priority-error' : undefined}
                            >
                                <legend>Priority *</legend>

                                <div className="priority-options">
                                    {['High', 'Medium', 'Low'].map(priority => (
                                        <label className="priority-option" key={priority}>
                                            <input
                                                type="radio"
                                                name="priority"
                                                value={priority}
                                                checked={form.priority === priority}
                                                onChange={changeField}
                                                required
                                            />
                                            <span>{priority}</span>
                                        </label>
                                    ))}
                                </div>
                            </fieldset>

                            {fieldError('priority')}
                        </div>

                        <div className="form-field">
                            <label htmlFor="assignment-notes">Notes (optional)</label>
                            <textarea
                                id="assignment-notes"
                                name="notes"
                                placeholder="Add any useful details."
                                value={form.notes}
                                onChange={changeField}
                                maxLength={2000}
                                rows={4}
                                {...errorAttributes('notes')}
                            />
                            {fieldError('notes')}
                        </div>

                        <div className="form-field">
                            <label htmlFor="assignment-reminder">Reminder</label>
                            <select
                                id="assignment-reminder"
                                name="reminderMinutes"
                                value={form.reminderMinutes}
                                onChange={changeField}
                                {...errorAttributes('reminderMinutes')}
                            >
                                <option value="60">1 hour before</option>
                                <option value="1440">1 day before</option>
                                <option value="2880">2 days before</option>
                                <option value="0">Off — no reminder</option>
                            </select>
                            <small>Uses your device time zone.</small>
                            {fieldError('reminderMinutes')}
                        </div>
                        {validationMode && (
                            <p className="helper">
                                Other entries are kept while you correct errors.
                            </p>
                        )}

                        <button className="primary-button" type="submit">
                            {saving
                                ? 'Saving…'
                                : validationMode
                                    ? 'Correct and save'
                                    : assignment
                                        ? 'Save changes'
                                        : 'Save assignment'}
                        </button>
                    </fieldset>
                    </form>
                )}

                <button
                    className="secondary-button"
                    onClick={onBack}
                    disabled={saving}
                >
                    Cancel
                </button>

                <p className="form-message error" role="status">{message}</p>
            </section>
        </main>
    )
}

export default AddAssignment