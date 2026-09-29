import './App.css'

function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>Assignment Reminder</h1>
        <div className="profile">Student</div>
      </header>

      <div className="layout">
        <nav className="sidebar">
          <h2>Menu</h2>
          <a href="#">Dashboard</a>
          <a href="#">Assignments</a>
          <a href="#">Calendar</a>
          <a href="#">Notifications</a>
        </nav>

        <main className="content">
          <h2>Dashboard</h2>
          <p>Welcome to your Assignment Reminder App.</p>

          <div className="dashboard-card">
            <h3>Upcoming Assignments</h3>
            <p>Your upcoming assignments will appear here.</p>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App