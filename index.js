// const express = require("express");
// const bodyParser = require("body-parser");
// const cors = require('cors');


// const app = express();
// app.use(cors()); // Enable CORS for all routes
// app.use(express.json());
// // Middleware to parse JSON bodies

// // Middleware to parse URL-encoded data (if needed)
// app.use(express.urlencoded({ extended: true }));

// // Import routes
// const userRoutes = require("./routes/userRoutes");

// // Use the routes
// app.use("/api", userRoutes);

// const PORT = 5000;

// app.listen(PORT, () => {
//     console.log(`Server is running on http://localhost:${PORT}`);
// });
const express = require("express");
const cors = require("cors");
const http = require("http");

const app = express();
const server = http.createServer(app); // Create HTTP server

// Import socket functions
// const { initializeSocket } = require("./socket");

// Initialize socket.io
// initializeSocket(server);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import routes
const userRoutes = require("./routes/userRoutes");
app.use("/api", userRoutes);

const PORT = 5000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
