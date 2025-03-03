const express = require("express");
const path = require("path");

const cors = require("cors");
const http = require("http");
const cron = require("node-cron");
const axios = require("axios");

const app = express();
const server = http.createServer(app); // Create HTTP server

// ✅ Enable CORS for all origins (change if needed)
app.use(cors({ origin: ["http://localhost:5173","http://localhost:3000"],
  methods: "GET,POST,PUT,DELETE", 
credentials: true }));



// // Serve uploads folder as a static directory
app.use("/uploads", express.static(path.resolve(__dirname, "uploads")));
// ✅ Enable JSON parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Import routes
const userRoutes = require("./routes/userRoutes");
app.use("/api", userRoutes);

// Dummy database function (replace with actual database connection)
const db = {
    query: async (query, values) => {
        console.log(`DB Query: ${query} with values ${values}`);
        return [[{ balance: 100 }]]; // Simulating a database response
    },
};

const PORT = 5000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
