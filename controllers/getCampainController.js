const db = require("../db/Connection"); // MySQL connection
const jwt = require('jsonwebtoken');
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
require('dotenv').config();


exports.getCampaigns = async (req, res) => {
    try {
        const [campaigns] = await db.query('SELECT * FROM campaigns');

        res.status(200).json({
            success: true,
            data: campaigns,
        });
    } catch (error) {
        console.error('Error fetching campaigns:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch campaign data',
        });
    }
};


exports.Clicks = async (req, res) => {
    try {
        const { user_id, coupon_id } = req.query;

        if (!user_id || !coupon_id) {
            return res.status(400).json({ success: false, message: "Missing parameters" });
        }

        // Fetch tracking_link & preview_url from database
        const [couponResult] = await db.query(
            "SELECT tracking_link, preview_url FROM campaigns WHERE id = ?",
            [coupon_id]
        );

        if (couponResult.length === 0) {
            return res.status(404).json({ success: false, message: "Coupon not found" });
        }

        const tracking_link = couponResult[0].tracking_link; 
        const preview_url = couponResult[0].preview_url; 
        if (!tracking_link || !preview_url) {
            return res.status(400).json({ success: false, message: "Tracking link or Preview URL missing" });
        }

        // Generate unique click_id
        const click_id = `CLK-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

        // Store click in database
        await db.query(
            "INSERT INTO clicks (click_id, user_id, coupon_id) VALUES (?, ?, ?)",
            [click_id, user_id, coupon_id]
        );

        console.log(`✅ Click recorded: User ID ${user_id}, Click ID ${click_id}`);

        // Append `p1={click_id}` to the tracking link
        const modifiedTrackingUrl = `${tracking_link}&p1=${click_id}`;
        console.log(modifiedTrackingUrl,preview_url,)

        // Call tracking link in the background (non-blocking)
        fetch(modifiedTrackingUrl)
            .then(() => console.log(`📡 Sent tracking request to: ${modifiedTrackingUrl}`))
            .catch((err) => console.error("⚠️ Tracking request failed:", err));

        // Redirect user to preview_url
        res.json({ success: true, redirectUrl: preview_url });

        // res.redirect(preview_url);

    } catch (error) {
        console.error("❌ Error recording click:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};



exports.trackConversion = async (req, res) => {
    try {
        const { click_id, amount } = req.query;

        if (!click_id || !amount) {
            return res.status(400).json({ success: false, message: "Invalid request" });
        }

        // Find the user_id from clicks table
        const [clickResult] = await db.query("SELECT * FROM clicks WHERE click_id = ?", [click_id]);

        if (clickResult.length === 0) {
            return res.status(404).json({ success: false, message: "Click ID not found" });
        }

        const userId = clickResult[0].user_id;

        // Store conversion in database
        await db.query(
            "INSERT INTO conversions (user_id, click_id, amount, status) VALUES (?, ?, ?, 'pending')",
            [userId, click_id, amount]
        );

        console.log(`✅ Pending conversion recorded for Click ID: ${click_id}`);

        res.json({ success: true, message: "Conversion tracked as pending!" });

    } catch (error) {
        console.error("❌ Error tracking conversion:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};



exports.getUserImage = async (req, res) => {
    try {
        const { user_id } = req.params;
        console.log("User ID:", user_id);

        // ✅ Fetch user image from DB
        const [user] = await db.query("SELECT img FROM users WHERE id = ?", [user_id]);

        if (user.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const imagePath = user[0].img;
        const fullImageUrl = `https://api.steptosale.com${imagePath}`;
        //http://localhost:5000

        console.log("✅ Image fetched successfully!");
        res.json({ success: true, image_url: fullImageUrl });

    } catch (error) {
        console.error("❌ Error fetching user image:", error);
        res.status(500).json({ message: "Failed to retrieve user image" });
    }
};




// Multer middleware export
