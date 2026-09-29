# Assignment Reminder App

A student app for organizing assignments, tracking deadlines, and receiving reminders. The project currently has a React frontend and an Express server skeleton.

## Requirements

- Node.js and npm

## Run the frontend

From the project folder:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually http://localhost:5173/.

## Run the server

Open a second terminal:

```bash
cd server
npm install
npm start
```

Check the server at http://localhost:3001/api/health. It should return a JSON response with `"status":"ok"`.

The frontend and server are currently separate; app features and their connection are upcoming work.