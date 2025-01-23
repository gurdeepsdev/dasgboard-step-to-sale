const express = require('express');
const routes = require('./routes/userRoutes');  // Import routes

const app = express();
const PORT = 5000;

app.use('/api', routes);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
