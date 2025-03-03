const db = require('../db/Connection');
const jwt = require('jsonwebtoken');
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
require('dotenv').config();
const multer = require("multer");
const path = require("path");

const cron = require('node-cron');
const axios = require('axios');
const { transactionUtils } = require("../routes/transactionUtils"); // Import function

// const { sendNotification } = require("../socket"); // Import the function from socket.js


// Secret key for J
// WT (store this securely, e.g., in environment variables)
const JWT_SECRET = process.env.VITE_API_JWT_SECRET;

console.log("JWT_SECRET",JWT_SECRET)
// const JWT_SECRET = 'gurdeep0111';
dotenv.config();


// ✅ Fetch all coupons with SEO details
exports.getAllCoupons = async (req, res) => {
    try {
        const [coupons] = await db.query(`
            SELECT c.id, c.title, c.offer, c.amount, c.code, c.expiry_date, c.categore,
                   s.seo_title, s.seo_description, s.slug
            FROM coupons c
            JOIN coupon_seo s ON c.id = s.coupon_id
            ORDER BY c.id DESC
        `);

        res.status(200).json({ success: true, data: coupons });
    } catch (error) {
        console.error("Error fetching coupons:", error);
        res.status(500).json({ message: "Failed to fetch coupons" });
    }
};

exports.createAdmin = async (req, res) => {
    const { email, password, role, permissions } = req.body;
    
    if (!email || !password || !role || !permissions) {
        return res.status(400).json({ message: "All fields are required" });
    }

    try {
        // Hash the password before storing it
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert into database
        const sql = `INSERT INTO admins (email, password, role, permissions) VALUES (?, ?, ?, ?)`;
        db.query(sql, [email, hashedPassword, role, JSON.stringify(permissions)], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });

            res.status(201).json({ message: "Sub-admin created successfully" });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.loginAdmin = async (req, res) => {
    try {
        console.log("🟢 Login Request Received:", req.body);

        const { email, password } = req.body;

        // ✅ Validation: Ensure both email and password are provided
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        // ✅ Fetch Admin by Email
        const [results] = await db.query("SELECT * FROM admins WHERE email = ?", [email]);

        if (!results.length) {
            console.warn("⚠️ Admin not found");
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const admin = results[0];

        // ✅ Verify Password
        const passwordMatch = await bcrypt.compare(password, admin.password);

        if (!passwordMatch) {
            console.warn("⚠️ Incorrect password");
            return res.status(401).json({ message: "Invalid credentials" });
        }

        console.log("✅ Admin logged in successfully!");
        res.status(200).json({
            success: true,
            message: "Login successful",
            admin: {
                id: admin.id,
                email: admin.email,
            },
        });

    } catch (error) {
        console.error("❌ Server Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
