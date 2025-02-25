const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io"); // Import Socket.IO
const cron = require('node-cron');
const axios = require('axios');

const app = express();
const server = http.createServer(app); // Create HTTP server

// Initialize Socket.IO correctly
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173", // Adjust this for security (use your frontend URL)
    }
});

// Listen for client connections
io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("joinRoom", (userId) => {
        socket.join(userId); // Each user joins a room based on their userId
        console.log(`User ${userId} joined room`);
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});

// Dummy database function (replace with actual database connection)
const db = {
    query: async (query, values) => {
        console.log(`DB Query: ${query} with values ${values}`);
        return [[{ balance: 100 }]]; // Simulating a database response
    },
};


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
