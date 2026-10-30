import { useEffect, useState } from 'react'
import './Courses.css'

async function requestCourses(path = '', options = {}) {
    const response = await fetch(`/api/courses${path}`, options)
    const data = await response.json()

    if (!response.ok) {
        const error = new Error(data.message || 'Please try again.')
        error.fields = data.errors || {}
        throw error
    }

    return data
}

function Courses({ onBack, onViewAssignments, navigation }) {
    const [courses, setCourses] = useState([])
    const [view, setView] = useState('list')
    const [savedCourse, setSavedCourse] = useState(null)
    const [selected, setSelected] = useState(null)
    const [form, setForm] = useState({ code: '', name: '' })
    const [errors, setErrors] = useState({})
    const [message, setMessage] = useState('')
    const [success, setSuccess] = useState(false)
    const [busy, setBusy] = useState(false)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')
    const [reload, setReload] = useState(0)
    const [courseAssignmentCount, setCourseAssignmentCount] = useState(null)
    const [checkingRemoval, setCheckingRemoval] = useState(false)
    const [removalError, setRemovalError] = useState('')
    const [removalRetry, setRemovalRetry] = useState(0)

    useEffect(() => {
        const controller = new AbortController()
        setLoading(true)
        setLoadError('')

        requestCourses('', { signal: controller.signal })
            .then(data => setCourses(data.courses))
            .catch(error => {
                if (!controller.signal.aborted) {
                    setLoadError(error.message)
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false)
            })

        return () => controller.abort()
    }, [reload])
    useEffect(() => {
        if (view !== 'remove' || !selected) return

        const controller = new AbortController()

        setCheckingRemoval(true)
        setCourseAssignmentCount(null)
        setRemovalError('')

        async function checkAssignments() {
            try {
                const response = await fetch('/api/assignments', {
                    signal: controller.signal,
                })

                const data = await response.json()

                if (!response.ok) {
                    throw new Error(
                        data.message || 'Could not check this course’s assignments.',
                    )
                }

                if (!controller.signal.aborted) {
                    const count = data.assignments.filter(
                        assignment => assignment.courseId === selected.id,
                    ).length

                    setCourseAssignmentCount(count)
                }
            } catch (error) {
                if (!controller.signal.aborted) {
                    setRemovalError(
                        error instanceof TypeError
                            ? 'Unable to reach the server. Please retry.'
                            : error.message,
                    )
                }
            } finally {
                if (!controller.signal.aborted) {
                    setCheckingRemoval(false)
                }
            }
        }

        checkAssignments()

        return () => controller.abort()
    }, [view, selected, removalRetry])

    function clearFeedback() {
        setErrors({})
        setMessage('')
        setSuccess(false)
    }

    function openForm(course = null) {
        clearFeedback()
        setSelected(course)
        setForm(course
            ? { code: course.code, name: course.name }
            : { code: '', name: '' })
        setView('form')
    }

    function changeField(event) {
        const { name, value } = event.target
        setForm(current => ({ ...current, [name]: value }))
        clearFeedback()
    }

    async function saveCourse(event) {
        event.preventDefault()
        if (busy) return

        clearFeedback()
        setBusy(true)

        try {
            const data = await requestCourses(
                selected ? `/${selected.id}` : '',
                {
                    method: selected ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form),
                },
            )

            setCourses(current => {
                const updated = selected
                    ? current.map(course =>
                        course.id === selected.id
                            ? { ...course, ...data.course }
                            : course)
                    : [...current, data.course]

                return updated.sort((a, b) => a.code.localeCompare(b.code))
            })

            setSavedCourse(data.course)
            setView('saved')
            setSelected(null)
            setForm({ code: '', name: '' })
            setMessage('')
        } catch (error) {
            setErrors(error.fields || {})
            setMessage(
                error instanceof TypeError
                    ? 'Could not save. Your entries have been kept. Please retry.'
                    : error.message,
            )
        } finally {
            setBusy(false)
        }
    }

    async function removeCourse() {
        if (
            busy ||
            checkingRemoval ||
            removalError ||
            courseAssignmentCount !== 0
        ) return
        clearFeedback()
        setBusy(true)

        try {
            const data = await requestCourses(`/${selected.id}`, {
                method: 'DELETE',
            })

            setCourses(current =>
                current.filter(course => course.id !== selected.id))
            setSelected(null)
            setView('list')
            setSuccess(true)
            setMessage(data.message)
        } catch (error) {
            setMessage(
                error instanceof TypeError
                    ? 'Could not confirm removal. Please retry.'
                    : error.message,
            )
        } finally {
            setBusy(false)
        }
    }

    function cancel() {
        clearFeedback()
        setSelected(null)
        setForm({ code: '', name: '' })
        setView('list')
    }
    if (view === 'saved' && savedCourse) {
        return (
            <main className="auth-page">
                <section className="auth-card">
                    <h1>Changes saved</h1>

                    <p className="intro" role="status">
                        Your course was stored successfully.
                    </p>

                    <span className="saved-checkmark" aria-hidden="true">
                        ✓
                    </span>

                    <div className="saved-assignment-summary">
                        <h2>{savedCourse.code}</h2>
                        <p>{savedCourse.name}</p>
                    </div>

                    <button
                        type="button"
                        className="primary-button"
                        onClick={() => {
                            clearFeedback()
                            setSavedCourse(null)
                            setView('list')
                        }}
                    >
                        View courses
                    </button>

                    <button
                        type="button"
                        className="secondary-button"
                        onClick={onBack}
                    >
                        Back to dashboard
                    </button>
                </section>
            </main>
        )
    }

    return (
        <main
            className={`auth-page ${view === 'list' ? 'courses-list-page' : ''
                }`}
        >            <section className="auth-card courses-card">
                <button
                    className="back-button"
                    aria-label={view === 'list' ? 'Back to dashboard' : 'Back to courses'}
                    onClick={view === 'list' ? onBack : cancel}
                    disabled={busy}
                >
                    ‹
                </button>

                {view === 'list' && (
                    <>
                        <h1>Your courses</h1>
                        <p className="intro">Keep every task connected to a class.</p>

                        {loading ? (
                            <p role="status">Loading courses…</p>
                        ) : loadError ? (
                            <div>
                                <p className="error" role="alert">{loadError}</p>
                                <button
                                    className="secondary-button"
                                    onClick={() => setReload(current => current + 1)}
                                >
                                    Retry
                                </button>
                            </div>
                        ) : (
                            <>
                                <button
                                    className="primary-button courses-add-button"
                                    onClick={() => openForm()}
                                >
                                    + Add course
                                </button>

                                {courses.length === 0 ? (
                                    <div className="course-item">
                                        <h2>No courses yet</h2>
                                        <p>Add your first course to get started.</p>
                                    </div>
                                ) : (
                                    <ul className="course-list">
                                        {courses.map(course => (
                                            <li key={course.id}>
                                                <button
                                                    type="button"
                                                    className="course-item course-card-button"
                                                    onClick={() => openForm(course)}
                                                >
                                                    <span className="course-card-heading">
                                                        <strong>{course.code}</strong>
                                                        <span aria-hidden="true">›</span>
                                                    </span>

                                                    <span className="course-card-name">
                                                        {course.name}
                                                    </span>

                                                    <span className="course-assignment-count">
                                                        {course.activeAssignmentCount ?? 0}{' '}
                                                        {course.activeAssignmentCount === 1
                                                            ? 'active assignment'
                                                            : 'active assignments'}
                                                    </span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}


                            </>
                        )}
                    </>
                )}

                {view === 'form' && (
                    <>
                        <h1>{selected ? 'Edit course' : 'Add course'}</h1>
                        <p className="intro">Required fields are marked with *.</p>

                        <form onSubmit={saveCourse}>
                            <fieldset disabled={busy}>
                                <div className="form-field">
                                    <label htmlFor="course-code">Course code *</label>
                                    <input
                                        id="course-code"
                                        name="code"
                                        placeholder="CSCE 3444"
                                        value={form.code}
                                        onChange={changeField}
                                        maxLength={30}
                                        aria-invalid={Boolean(errors.code)}
                                        aria-describedby={errors.code ? 'code-error' : undefined}
                                        required
                                    />
                                    {errors.code && (
                                        <small className="field-error" id="code-error">
                                            {errors.code}
                                        </small>
                                    )}
                                </div>

                                <div className="form-field">
                                    <label htmlFor="course-name">Course name *</label>
                                    <input
                                        id="course-name"
                                        name="name"
                                        placeholder="Software Engineering"
                                        value={form.name}
                                        onChange={changeField}
                                        maxLength={120}
                                        aria-invalid={Boolean(errors.name)}
                                        aria-describedby={errors.name ? 'name-error' : undefined}
                                        required
                                    />
                                    {errors.name && (
                                        <small className="field-error" id="name-error">
                                            {errors.name}
                                        </small>
                                    )}
                                </div>

                                <button className="primary-button" type="submit">
                                    {busy ? 'Saving…' : selected ? 'Save changes' : 'Save course'}
                                </button>
                            </fieldset>
                        </form>

                        <button
                            className="secondary-button"
                            onClick={cancel}
                            disabled={busy}
                        >
                            Cancel
                        </button>
                        {selected && (
                            <div className="course-edit-removal">
                                <button
                                    type="button"
                                    className="secondary-button"
                                    disabled={busy}
                                    onClick={() => {
                                        clearFeedback()
                                        setView('remove')
                                    }}
                                >
                                    Remove course
                                </button>

                                <p className="helper">
                                    Removal requires confirmation.
                                </p>
                            </div>
                        )}
                    </>
                )}

                {view === 'remove' && (
                    <>
                        <h1>Remove course?</h1>

                        <p className="intro">
                            {selected.code} · {selected.name}
                        </p>

                        {checkingRemoval || (
                            courseAssignmentCount === null && !removalError
                        ) ? (
                            <p role="status">Checking assignments…</p>
                        ) : removalError ? (
                            <>
                                <p className="error" role="alert">
                                    {removalError}
                                </p>

                                <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() => setRemovalRetry(current => current + 1)}
                                >
                                    Retry
                                </button>
                            </>
                        ) : courseAssignmentCount > 0 ? (
                            <>
                                <div className="course-removal-warning">
                                    <strong>
                                        {courseAssignmentCount}{' '}
                                        {courseAssignmentCount === 1
                                            ? 'assignment uses'
                                            : 'assignments use'} this course
                                    </strong>

                                    <p>
                                        Move or delete these assignments before removing
                                        the course.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    className="primary-button"
                                    onClick={onViewAssignments}
                                >
                                    View assignments
                                </button>
                            </>
                        ) : null}

                        <button
                            type="button"
                            className="secondary-button"
                            onClick={cancel}
                            disabled={busy}
                        >
                            Keep course
                        </button>


                        <p className="course-removal-label">
                            WHEN NO ASSIGNMENTS REMAIN
                        </p>

                        <section className="course-removal-confirmation">
                            <h2>Remove this empty course?</h2>

                            <button
                                type="button"
                                className="primary-button course-confirm-removal"
                                onClick={removeCourse}
                                disabled={
                                    busy ||
                                    checkingRemoval ||
                                    Boolean(removalError) ||
                                    courseAssignmentCount !== 0
                                }
                            >
                                {busy ? 'Removing…' : 'Confirm removal'}
                            </button>
                        </section>

                    </>
                )}

                <p
                    className={`form-message ${success ? 'success' : 'error'}`}
                    role="status"
                >
                    {message}
                </p>
            </section>

            {view === 'list' && navigation}
        </main>
    )
}

export default Courses