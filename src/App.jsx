import { useEffect, useState } from 'react'
import './App.css'
import Dashboard from './Dashboard'

const emptyForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
}

function App() {
  const [screen, setScreen] = useState('welcome')
  const [form, setForm] = useState(emptyForm)
  const [user, setUser] = useState(null)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    async function checkSession() {
      try {
        const response = await fetch('/api/auth/me', {
          signal: controller.signal,
        })

        if (response.ok) {
          const data = await response.json()
          setUser(data.user)
        }
      } catch {
        // The welcome screen remains available if the server is offline.
      } finally {
        if (!controller.signal.aborted) {
          setCheckingSession(false)
        }
      }
    }

    checkSession()
    return () => controller.abort()
  }, [])

  function openScreen(nextScreen) {
    setScreen(nextScreen)
    setForm(emptyForm)
    setMessage('')
    setSuccess(false)
  }

  function handleChange(event) {
    const { name, value } = event.target
    setForm(current => ({ ...current, [name]: value }))
    setMessage('')
    setSuccess(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (loading) return

    const registering = screen === 'register'
    setMessage('')
    setSuccess(false)

    if (registering && form.password !== form.confirmPassword) {
      setMessage('Passwords do not match.')
      return
    }

    if (new TextEncoder().encode(form.password).length > 72) {
      setMessage('Password must be at most 72 bytes.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(
        registering ? '/api/auth/register' : '/api/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            registering
              ? {
                name: form.name,
                email: form.email,
                password: form.password,
              }
              : {
                email: form.email,
                password: form.password,
              },
          ),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        setMessage(data.message || 'Please try again.')
        return
      }

      if (registering) {
        setScreen('login')
        setForm({ ...emptyForm, email: form.email.trim() })
        setSuccess(true)
        setMessage('Account created successfully. You can now log in.')
      } else {
        setUser(data.user)
        setForm(emptyForm)
        setMessage('')
      }
    } catch {
      setMessage('Unable to reach the server. Your entries have been kept.')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    if (loading) return
    setLoading(true)
    setMessage('')
    setSuccess(false)

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      })

      if (!response.ok) {
        setMessage('Unable to log out. Please try again.')
        return
      }

      setUser(null)
      openScreen('welcome')
    } catch {
      setMessage('Unable to reach the server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <main className="auth-page">
        <p role="status">Opening Assignment Reminder…</p>
      </main>
    )
  }

  if (user) {
    return (
      <Dashboard
        user={user}
        onLogout={handleLogout}
        loading={loading}
        message={message}
      />
    )
  }

  if (screen === 'welcome') {
    return (
      <main className="auth-page">
        <section className="auth-card welcome-card">
          <div className="welcome-illustration" aria-hidden="true">
            <svg viewBox="0 0 100 100">
              <rect
                x="23"
                y="28"
                width="50"
                height="47"
                rx="7"
                fill="none"
                stroke="var(--teal)"
                strokeWidth="2"
              />
              <path
                d="M23 43h50M36 21v15M60 21v15"
                fill="none"
                stroke="var(--teal)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle
                cx="70"
                cy="74"
                r="18"
                fill="var(--navy)"
                stroke="var(--background)"
                strokeWidth="2"
              />
              <path
                d="m62 74 5 5 11-12"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1>
            Assignment
            <br />
            Reminder App
          </h1>

          <p className="welcome-subtitle">
            A little planning.
            <br />
            A clearer semester.
          </p>

          <div className="welcome-note">
            <strong>Organize. Track. Remember.</strong>
            <p>Your courses and deadlines, together.</p>
          </div>

          <div className="welcome-actions">
            <button
              className="primary-button"
              onClick={() => openScreen('register')}
            >
              Create account
            </button>

            <button
              className="secondary-button"
              onClick={() => openScreen('login')}
            >
              Log in
            </button>
          </div>

          <p className="welcome-footer">
            Plan your work. Keep your peace.
          </p>
        </section>
      </main>
    )
  }

  const registering = screen === 'register'

  return (
    <main className="auth-page">
      <section className="auth-card">
        <button
          className="back-button"
          aria-label="Back to welcome"
          onClick={() => openScreen('welcome')}
          disabled={loading}
        >
          ‹
        </button>

        <h1>{registering ? 'Create account' : 'Welcome back'}</h1>
        <p className="intro">
          {registering
            ? 'Start organizing your semester.'
            : 'Log in to view your assignments.'}
        </p>

        <form onSubmit={handleSubmit}>
          <fieldset disabled={loading}>
            {registering && (
              <div className="form-field">
                <label htmlFor="name">Full name *</label>
                <input
                  id="name"
                  name="name"
                  placeholder="Your full name"
                  autoComplete="name"
                  value={form.name}
                  onChange={handleChange}
                  minLength={2}
                  maxLength={100}
                  required
                />
              </div>
            )}

            <div className="form-field">
              <label htmlFor="email">Email address *</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="student@example.edu"
                autoComplete={registering ? 'email' : 'username'}
                value={form.email}
                onChange={handleChange}
                maxLength={254}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="password">Password *</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={
                  registering ? 'new-password' : 'current-password'
                }
                aria-describedby={
                  registering ? 'password-help' : undefined
                }
                value={form.password}
                onChange={handleChange}
                minLength={registering ? 8 : undefined}
                required
              />

              {registering && (
                <small id="password-help">
                  At least 8 characters. Password stays hidden.
                </small>
              )}
            </div>

            {registering && (
              <div className="form-field">
                <label htmlFor="confirmPassword">Confirm password *</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  minLength={8}
                  required
                />
              </div>
            )}

            <button className="primary-button submit-button" type="submit">
              {loading
                ? registering
                  ? 'Creating account…'
                  : 'Logging in…'
                : registering
                  ? 'Create account'
                  : 'Log in'}
            </button>
          </fieldset>
        </form>

        <button
          className="secondary-button"
          onClick={() => openScreen(registering ? 'login' : 'register')}
          disabled={loading}
        >
          {registering
            ? 'Already have an account? Log in'
            : 'Create account'}
        </button>

        <p className="required-note">* Required fields</p>

        <p
          className={`form-message ${success ? 'success' : 'error'}`}
          role="status"
        >
          {message}
        </p>
      </section>
    </main>
  )
}

export default App