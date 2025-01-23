const express = require("express");
const bodyParser = require("body-parser");

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Middleware to parse URL-encoded data (if needed)
app.use(express.urlencoded({ extended: true }));

// Import routes
const userRoutes = require("./routes/userRoutes");

// Use the routes
app.use("/api", userRoutes);

const PORT = 5000;

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
