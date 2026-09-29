const express = require('express');

const app = express();
const PORT = 3001;

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: 'Assignment Reminder' });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

